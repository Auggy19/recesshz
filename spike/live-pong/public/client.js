/**
 * Spike client — paddle input only; render server state at 15 Hz.
 * Keep-alive: exponential backoff reconnect, visibility + online recovery.
 */
(function () {
  const params = new URLSearchParams(location.search);
  const room = (params.get("room") || "demo").slice(0, 32);

  const SESSION_KEY = "spike-pong-session:" + room;
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(SESSION_KEY, sessionId);
  }

  document.getElementById("roomLabel").textContent = room;

  const court = document.getElementById("court");
  const padTop = document.getElementById("padTop");
  const padBottom = document.getElementById("padBottom");
  const ball = document.getElementById("ball");
  const banner = document.getElementById("banner");
  const bannerText = document.getElementById("bannerText");
  const statusEl = document.getElementById("status");
  const metricsEl = document.getElementById("metrics");
  const scoreYou = document.getElementById("scoreYou");
  const scoreOpp = document.getElementById("scoreOpp");
  const phaseLabel = document.getElementById("phaseLabel");
  const rematchBtn = document.getElementById("rematch");

  let side = null;
  let myX = 50;
  let keys = { left: false, right: false };
  let dragging = false;
  let lastSend = 0;
  let bytesIn = 0;
  let msgsIn = 0;
  let windowStart = performance.now();

  const PW = 22;

  function setBanner(text) {
    if (!text) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    bannerText.textContent = text;
  }

  function applyState(s) {
    if (!side) return;

    const youIsBottom = side === "bottom";
    const myPad = youIsBottom ? padBottom : padTop;
    const oppPad = youIsBottom ? padTop : padBottom;

    const topX = s.paddles.top;
    const botX = s.paddles.bottom;
    const displayMy = youIsBottom ? botX : topX;
    const displayOpp = youIsBottom ? topX : botX;

    myPad.style.left = displayMy - PW / 2 + "%";
    myPad.style.bottom = "3.5%";
    myPad.style.top = "auto";
    oppPad.style.left = displayOpp - PW / 2 + "%";
    oppPad.style.top = "3.5%";
    oppPad.style.bottom = "auto";

    let bx = s.ball.x;
    let by = s.ball.y;
    if (side === "top") by = 100 - by;
    ball.style.left = bx + "%";
    ball.style.top = by + "%";

    const myScore = youIsBottom ? s.scores.bottom : s.scores.top;
    const oppScore = youIsBottom ? s.scores.top : s.scores.bottom;
    scoreYou.textContent = "YOU " + myScore;
    scoreOpp.textContent = "OPP " + oppScore;

    phaseLabel.textContent = s.phase.replace("_", " ");

    if (s.phase === "countdown") {
      setBanner(String(s.countdownLeft ?? "…"));
      statusEl.textContent = "Get ready…";
      rematchBtn.hidden = true;
    } else if (s.phase === "playing") {
      setBanner("");
      statusEl.textContent = "Playing — drag to move";
      rematchBtn.hidden = true;
    } else if (s.phase === "paused") {
      setBanner("Paused");
      statusEl.textContent = "Opponent disconnected — 20s to reconnect";
      rematchBtn.hidden = true;
    } else if (s.phase === "match_over") {
      const iWon =
        (s.winner === "bottom" && youIsBottom) ||
        (s.winner === "top" && !youIsBottom);
      setBanner(iWon ? "You win!" : "You lose");
      statusEl.textContent = "Match over";
      rematchBtn.hidden = false;
    } else if (s.phase === "lobby") {
      setBanner("Waiting");
      statusEl.textContent = "Waiting for opponent… open a second tab";
      rematchBtn.hidden = true;
    }
  }

  function pointerToX(clientX) {
    const r = court.getBoundingClientRect();
    return ((clientX - r.left) / r.width) * 100;
  }

  function clampPad(x) {
    return Math.max(PW / 2, Math.min(100 - PW / 2, x));
  }

  function tickInput() {
    let m = 0;
    if (keys.left) m -= 1;
    if (keys.right) m += 1;
    if (!dragging && m !== 0) {
      myX = clampPad(myX + m * 2.2);
    }
    const now = performance.now();
    if (ws && ws.readyState === 1 && now - lastSend > 33) {
      lastSend = now;
      ws.send(JSON.stringify({ type: "paddle", x: myX }));
    }
    requestAnimationFrame(tickInput);
  }
  requestAnimationFrame(tickInput);

  court.addEventListener("pointerdown", (e) => {
    court.setPointerCapture(e.pointerId);
    dragging = true;
    myX = clampPad(pointerToX(e.clientX));
  });
  court.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    myX = clampPad(pointerToX(e.clientX));
  });
  court.addEventListener("pointerup", () => {
    dragging = false;
  });
  court.addEventListener("pointercancel", () => {
    dragging = false;
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      e.preventDefault();
      keys.left = true;
    }
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      e.preventDefault();
      keys.right = true;
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });

  rematchBtn.addEventListener("click", () => {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify({ type: "rematch" }));
    }
  });

  setInterval(() => {
    const elapsed = (performance.now() - windowStart) / 1000;
    if (elapsed >= 1) {
      const bps = Math.round(bytesIn / elapsed);
      const mps = (msgsIn / elapsed).toFixed(1);
      metricsEl.textContent =
        "in ~" + bps + " B/s \u00b7 " + mps + " msg/s \u00b7 target 15 Hz";
      bytesIn = 0;
      msgsIn = 0;
      windowStart = performance.now();
    }
  }, 500);

  let ws;
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let intentionalClose = false;

  function backoffMs(attempt) {
    const base = Math.min(30_000, 500 * Math.pow(2, attempt));
    const jitter = base * (Math.random() * 0.5);
    return Math.round(base + jitter);
  }

  function scheduleReconnect(reason) {
    if (reconnectTimer) return;
    const delay = backoffMs(reconnectAttempt);
    reconnectAttempt += 1;
    statusEl.textContent =
      "Disconnected (" +
      reason +
      ") \u2014 retry in " +
      (delay / 1000).toFixed(1) +
      "s\u2026";
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function connect() {
    if (
      ws &&
      (ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    statusEl.textContent = "Connecting\u2026";
    ws = new WebSocket(proto + "//" + location.host);

    ws.onopen = () => {
      reconnectAttempt = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      ws.send(JSON.stringify({ type: "join", room, sessionId }));
      statusEl.textContent = "Joined \u2014 waiting for peer";
    };

    ws.onmessage = (ev) => {
      bytesIn += typeof ev.data === "string" ? ev.data.length : 0;
      msgsIn += 1;
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      if (msg.type === "welcome") {
        side = msg.side;
        if (msg.sessionId) {
          sessionId = msg.sessionId;
          localStorage.setItem(SESSION_KEY, sessionId);
        }
        statusEl.textContent =
          "You are " + (side === "bottom" ? "bottom" : "top") + " paddle";
        return;
      }
      if (msg.type === "error") {
        statusEl.textContent = msg.message || "Error";
        setBanner("Full");
        return;
      }
      if (msg.type === "lobby") {
        statusEl.textContent =
          msg.players >= 2
            ? "Both here"
            : "Waiting for opponent\u2026 (" + msg.players + "/2)";
        if (msg.players < 2) setBanner("Waiting");
        return;
      }
      if (msg.type === "countdown") {
        setBanner(String(msg.n));
        return;
      }
      if (msg.type === "pause") {
        setBanner("Paused");
        statusEl.textContent =
          "Paused \u2014 reconnect window " +
          Math.round((msg.resumeInMs || 20000) / 1000) +
          "s";
        return;
      }
      if (msg.type === "match_over") {
        return;
      }
      if (msg.type === "state") {
        applyState(msg);
        if (side === "bottom") myX = msg.paddles.bottom;
        else if (side === "top") myX = msg.paddles.top;
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      if (intentionalClose) return;
      scheduleReconnect("closed");
    };
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (
      !ws ||
      ws.readyState === WebSocket.CLOSED ||
      ws.readyState === WebSocket.CLOSING
    ) {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempt = 0;
      connect();
      return;
    }
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: "paddle", x: myX }));
      } catch {
        /* ignore */
      }
    }
  });

  window.addEventListener("online", () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAttempt = 0;
      connect();
    }
  });

  connect();
})();
