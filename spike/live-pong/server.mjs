/**
 * Isolated Live Pong spike — Node HTTP + WebSocket.
 * Server-authoritative physics. 15 Hz state broadcast.
 * Field-level deltas + keyframes (~1s). Clients send paddle X only.
 * First to 7. Pause 20s on disconnect.
 * Keep-alive: protocol ping every 25s; no pong → terminate zombie.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, "public");
const PORT = Number(process.env.PORT) || 3099;
const HOST = process.env.HOST || "0.0.0.0";

const TICK_HZ = 60;
const BROADCAST_HZ = 15;
const TARGET_SCORE = 7;
const RECONNECT_MS = 20_000;
const COUNTDOWN_S = 3;
const PING_INTERVAL_MS = 25_000;
/** Full snapshot every N broadcast ticks (~1s at 15 Hz). */
const KEYFRAME_EVERY = 15;
/** Quantize positions to 2 decimals for wire + delta compare. */
const Q = 100;

const PW = 22;
const PH = 2.8;
const BR = 1.8;
const BASE_SPEED = 36;
const MAX_SPEED = 85;
const WALL_ACC = 1.05;
const PAD_ACC = 1.1;

/** @type {Map<string, any>} */
const rooms = new Map();

let lastBytes = 0;

function q2(n) {
  return Math.round(n * Q) / Q;
}

function emptySeat() {
  return { ws: null, sessionId: null, paddleX: 50, lastSeen: 0 };
}

function createRoom(id) {
  const room = {
    id,
    bottom: emptySeat(),
    top: emptySeat(),
    phase: "lobby",
    countdownLeft: 0,
    scoresBottom: 0,
    scoresTop: 0,
    ballX: 50,
    ballY: 50,
    vx: 0,
    vy: 0,
    speed: BASE_SPEED,
    vacantSide: null,
    reconnectTimer: null,
    winner: null,
    stateSeq: 0,
    lastSnap: null,
  };
  rooms.set(id, room);
  return room;
}

function getRoom(id) {
  return rooms.get(id) || createRoom(id);
}

function seatFor(room, side) {
  return side === "bottom" ? room.bottom : room.top;
}

function opposite(side) {
  return side === "bottom" ? "top" : "bottom";
}

function bothConnected(room) {
  return room.bottom.ws !== null && room.top.ws !== null;
}

function connectedCount(room) {
  return (room.bottom.ws ? 1 : 0) + (room.top.ws ? 1 : 0);
}

function send(ws, msg) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(room, msg) {
  const raw = JSON.stringify(msg);
  for (const side of ["bottom", "top"]) {
    const s = seatFor(room, side);
    if (s.ws && s.ws.readyState === 1) s.ws.send(raw);
  }
  return raw.length;
}

function buildSnap(room) {
  return {
    phase: room.phase,
    ball: { x: q2(room.ballX), y: q2(room.ballY) },
    paddles: {
      bottom: q2(room.bottom.paddleX),
      top: q2(room.top.paddleX),
    },
    scores: { bottom: room.scoresBottom, top: room.scoresTop },
    target: TARGET_SCORE,
    countdownLeft: room.phase === "countdown" ? room.countdownLeft : null,
    vacantSide: room.vacantSide,
    winner: room.winner,
  };
}

function makeWire(room, forceFull = false) {
  room.stateSeq += 1;
  const snap = buildSnap(room);
  const prev = room.lastSnap;

  const needFull =
    forceFull ||
    !prev ||
    room.stateSeq % KEYFRAME_EVERY === 1 ||
    prev.phase !== snap.phase;

  if (needFull) {
    room.lastSnap = snap;
    const msg = {
      type: "state",
      full: true,
      seq: room.stateSeq,
      t: Date.now(),
      phase: snap.phase,
      ball: snap.ball,
      paddles: snap.paddles,
      scores: snap.scores,
      target: snap.target,
    };
    if (snap.countdownLeft != null) msg.countdownLeft = snap.countdownLeft;
    if (snap.vacantSide != null) msg.vacantSide = snap.vacantSide;
    if (snap.winner != null) msg.winner = snap.winner;
    return msg;
  }

  const d = {
    type: "state",
    full: false,
    seq: room.stateSeq,
    t: Date.now(),
  };

  if (snap.ball.x !== prev.ball.x || snap.ball.y !== prev.ball.y) {
    d.ball = snap.ball;
  }

  const pads = {};
  if (snap.paddles.bottom !== prev.paddles.bottom) {
    pads.bottom = snap.paddles.bottom;
  }
  if (snap.paddles.top !== prev.paddles.top) {
    pads.top = snap.paddles.top;
  }
  if (Object.keys(pads).length) d.paddles = pads;

  if (
    snap.scores.bottom !== prev.scores.bottom ||
    snap.scores.top !== prev.scores.top
  ) {
    d.scores = snap.scores;
  }

  if (snap.countdownLeft !== prev.countdownLeft) {
    d.countdownLeft = snap.countdownLeft;
  }
  if (snap.vacantSide !== prev.vacantSide) {
    d.vacantSide = snap.vacantSide;
  }
  if (snap.winner !== prev.winner) {
    d.winner = snap.winner;
  }

  room.lastSnap = snap;
  return d;
}

function broadcastState(room, forceFull = false) {
  return broadcast(room, makeWire(room, forceFull));
}

function serveBall(room, towardBottom) {
  room.ballX = 50;
  room.ballY = 50;
  room.speed = BASE_SPEED;
  const ang = (Math.random() * 0.7 - 0.35) * Math.PI;
  room.vx = Math.sin(ang);
  room.vy = (towardBottom ? 1 : -1) * Math.abs(Math.cos(ang));
  const m = Math.hypot(room.vx, room.vy) || 1;
  room.vx /= m;
  room.vy /= m;
}

function resetMatch(room) {
  room.scoresBottom = 0;
  room.scoresTop = 0;
  room.ballX = 50;
  room.ballY = 50;
  room.vx = 0;
  room.vy = 0;
  room.speed = BASE_SPEED;
  room.winner = null;
  room.bottom.paddleX = 50;
  room.top.paddleX = 50;
  room.lastSnap = null;
  if (bothConnected(room)) startCountdown(room);
  else {
    room.phase = "lobby";
    broadcast(room, { type: "lobby", players: connectedCount(room) });
  }
}

function startCountdown(room) {
  if (room.reconnectTimer) {
    clearTimeout(room.reconnectTimer);
    room.reconnectTimer = null;
  }
  room.vacantSide = null;
  room.phase = "countdown";
  room.countdownLeft = COUNTDOWN_S;
  broadcast(room, { type: "countdown", n: room.countdownLeft });
  broadcastState(room, true);
}

function startPlay(room) {
  room.phase = "playing";
  serveBall(room, Math.random() > 0.5);
  broadcastState(room, true);
}

function award(room, to) {
  if (to === "bottom") room.scoresBottom += 1;
  else room.scoresTop += 1;

  if (room.scoresBottom >= TARGET_SCORE || room.scoresTop >= TARGET_SCORE) {
    room.phase = "match_over";
    room.winner = room.scoresBottom >= TARGET_SCORE ? "bottom" : "top";
    room.vx = 0;
    room.vy = 0;
    broadcast(room, {
      type: "match_over",
      winner: room.winner,
      scores: { bottom: room.scoresBottom, top: room.scoresTop },
    });
    broadcastState(room, true);
    return;
  }

  serveBall(room, to === "bottom");
}

function simulate(room, dt) {
  if (room.phase !== "playing") return;

  room.ballX += room.vx * room.speed * dt;
  room.ballY += room.vy * room.speed * dt;

  if (room.ballX - BR <= 0) {
    room.ballX = BR;
    room.vx = Math.abs(room.vx);
    room.speed = Math.min(MAX_SPEED, room.speed * WALL_ACC);
  } else if (room.ballX + BR >= 100) {
    room.ballX = 100 - BR;
    room.vx = -Math.abs(room.vx);
    room.speed = Math.min(MAX_SPEED, room.speed * WALL_ACC);
  }

  const topY = 4;
  const topBot = topY + PH;
  if (
    room.vy < 0 &&
    room.ballY - BR <= topBot &&
    room.ballY + BR >= topY &&
    room.ballX >= room.top.paddleX - PW / 2 - BR &&
    room.ballX <= room.top.paddleX + PW / 2 + BR
  ) {
    room.ballY = topBot + BR;
    room.vy = Math.abs(room.vy);
    const o = (room.ballX - room.top.paddleX) / (PW / 2);
    room.vx = Math.max(-0.95, Math.min(0.95, room.vx * 0.85 + o * 0.55));
    const m = Math.hypot(room.vx, room.vy) || 1;
    room.vx /= m;
    room.vy /= m;
    room.speed = Math.min(MAX_SPEED, room.speed * PAD_ACC);
  }

  const botY = 96;
  const botTop = botY - PH;
  if (
    room.vy > 0 &&
    room.ballY + BR >= botTop &&
    room.ballY - BR <= botY &&
    room.ballX >= room.bottom.paddleX - PW / 2 - BR &&
    room.ballX <= room.bottom.paddleX + PW / 2 + BR
  ) {
    room.ballY = botTop - BR;
    room.vy = -Math.abs(room.vy);
    const o = (room.ballX - room.bottom.paddleX) / (PW / 2);
    room.vx = Math.max(-0.95, Math.min(0.95, room.vx * 0.85 + o * 0.55));
    const m = Math.hypot(room.vx, room.vy) || 1;
    room.vx /= m;
    room.vy /= m;
    room.speed = Math.min(MAX_SPEED, room.speed * PAD_ACC);
  }

  if (room.ballY < -3) award(room, "bottom");
  else if (room.ballY > 103) award(room, "top");
}

function findSideBySession(room, sessionId) {
  if (room.bottom.sessionId === sessionId) return "bottom";
  if (room.top.sessionId === sessionId) return "top";
  return null;
}

function assignSeat(room, ws, sessionId) {
  if (sessionId) {
    const existing = findSideBySession(room, sessionId);
    if (existing) {
      const seat = seatFor(room, existing);
      if (!seat.ws || seat.ws === ws) {
        seat.ws = ws;
        seat.lastSeen = Date.now();
        return existing;
      }
    }
  }

  if (!room.bottom.ws) {
    room.bottom.ws = ws;
    room.bottom.sessionId = sessionId;
    room.bottom.lastSeen = Date.now();
    return "bottom";
  }
  if (!room.top.ws) {
    room.top.ws = ws;
    room.top.sessionId = sessionId;
    room.top.lastSeen = Date.now();
    return "top";
  }
  return null;
}

function onDisconnect(room, side) {
  const seat = seatFor(room, side);
  seat.ws = null;

  if (room.phase === "playing" || room.phase === "countdown") {
    room.phase = "paused";
    room.vacantSide = side;
    room.vx = 0;
    room.vy = 0;
    broadcast(room, {
      type: "pause",
      reason: "opponent_disconnected",
      resumeInMs: RECONNECT_MS,
      vacantSide: side,
    });
    broadcastState(room, true);

    if (room.reconnectTimer) clearTimeout(room.reconnectTimer);
    room.reconnectTimer = setTimeout(() => {
      room.reconnectTimer = null;
      if (room.phase !== "paused") return;
      const remaining = opposite(side);
      room.phase = "match_over";
      room.winner = remaining;
      if (remaining === "bottom") room.scoresBottom = TARGET_SCORE;
      else room.scoresTop = TARGET_SCORE;
      broadcast(room, {
        type: "match_over",
        winner: remaining,
        reason: "forfeit",
        scores: { bottom: room.scoresBottom, top: room.scoresTop },
      });
      broadcastState(room, true);
    }, RECONNECT_MS);
    return;
  }

  if (room.phase === "match_over") {
    broadcast(room, { type: "lobby", players: connectedCount(room) });
    return;
  }

  room.phase = "lobby";
  broadcast(room, { type: "lobby", players: connectedCount(room) });
}

function onJoin(room, ws, sessionId) {
  if (bothConnected(room) && !findSideBySession(room, sessionId)) {
    send(ws, { type: "error", message: "Room full (2 players max)" });
    ws.close();
    return;
  }

  const side = assignSeat(room, ws, sessionId);
  if (!side) {
    send(ws, { type: "error", message: "Room full" });
    ws.close();
    return;
  }

  ws.__roomId = room.id;
  ws.__side = side;
  ws.__sessionId = sessionId;

  send(ws, {
    type: "welcome",
    side,
    room: room.id,
    sessionId,
    target: TARGET_SCORE,
  });

  if (room.phase === "paused" && room.vacantSide === side) {
    if (room.reconnectTimer) {
      clearTimeout(room.reconnectTimer);
      room.reconnectTimer = null;
    }
    room.vacantSide = null;
    if (bothConnected(room)) {
      startCountdown(room);
    }
    return;
  }

  if (bothConnected(room) && (room.phase === "lobby" || room.phase === "match_over")) {
    room.scoresBottom = 0;
    room.scoresTop = 0;
    room.winner = null;
    startCountdown(room);
    return;
  }

  broadcast(room, { type: "lobby", players: connectedCount(room) });
  send(ws, makeWire(room, true));
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  if (url.pathname === "/metrics") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        rooms: rooms.size,
        broadcastHz: BROADCAST_HZ,
        lastBytesPerSecApprox: lastBytes,
        targetScore: TARGET_SCORE,
        reconnectMs: RECONNECT_MS,
        pingIntervalMs: PING_INTERVAL_MS,
        keyframeEvery: KEYFRAME_EVERY,
        delta: true,
      }),
    );
    return;
  }
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  const abs = path.join(PUBLIC, path.normalize(filePath));
  if (!abs.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(abs, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(abs);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }

    if (msg.type === "join") {
      const roomId = String(msg.room || "demo").slice(0, 32);
      const sessionId =
        typeof msg.sessionId === "string" && msg.sessionId.length > 0
          ? msg.sessionId.slice(0, 64)
          : cryptoRandom();
      const room = getRoom(roomId);
      onJoin(room, ws, sessionId);
      return;
    }

    const roomId = ws.__roomId;
    const side = ws.__side;
    if (!roomId || !side) return;
    const room = rooms.get(roomId);
    if (!room) return;

    if (msg.type === "paddle") {
      const x = Number(msg.x);
      if (!Number.isFinite(x)) return;
      const seat = seatFor(room, side);
      seat.paddleX = Math.max(PW / 2, Math.min(100 - PW / 2, x));
      seat.lastSeen = Date.now();
      return;
    }

    if (msg.type === "rematch" && room.phase === "match_over") {
      if (bothConnected(room)) resetMatch(room);
    }
  });

  ws.on("close", () => {
    const roomId = ws.__roomId;
    const side = ws.__side;
    if (!roomId || !side) return;
    const room = rooms.get(roomId);
    if (!room) return;
    const seat = seatFor(room, side);
    if (seat.ws === ws) onDisconnect(room, side);
  });
});

function cryptoRandom() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

let lastSim = Date.now();
let bytesWindow = 0;
let bytesWindowStart = Date.now();

setInterval(() => {
  const now = Date.now();
  const dt = Math.min(0.05, (now - lastSim) / 1000);
  lastSim = now;

  for (const room of rooms.values()) {
    if (room.phase === "playing") {
      simulate(room, dt);
    }
  }
}, 1000 / TICK_HZ);

setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== "countdown") continue;
    room.countdownLeft -= 1;
    if (room.countdownLeft <= 0) {
      startPlay(room);
    } else {
      broadcast(room, { type: "countdown", n: room.countdownLeft });
      broadcastState(room, true);
    }
  }
}, 1000);

setInterval(() => {
  const now = Date.now();
  let total = 0;
  for (const room of rooms.values()) {
    if (
      room.phase === "playing" ||
      room.phase === "paused" ||
      room.phase === "countdown"
    ) {
      total += broadcastState(room, false);
    }
  }
  bytesWindow += total;
  if (now - bytesWindowStart >= 1000) {
    lastBytes = bytesWindow;
    bytesWindow = 0;
    bytesWindowStart = now;
  }
}, 1000 / BROADCAST_HZ);

const pingInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
      continue;
    }
    ws.isAlive = false;
    try {
      ws.ping();
    } catch {
      try {
        ws.terminate();
      } catch {
        /* ignore */
      }
    }
  }
}, PING_INTERVAL_MS);

wss.on("close", () => clearInterval(pingInterval));

server.listen(PORT, HOST, () => {
  console.log(`[spike-live-pong] listening on http://${HOST}:${PORT}`);
  console.log(`[spike-live-pong] open TWO clients: /?room=demo`);
  console.log(
    `[spike-live-pong] 15 Hz field-deltas; keyframe every ${KEYFRAME_EVERY}; first to ${TARGET_SCORE}`,
  );
});
