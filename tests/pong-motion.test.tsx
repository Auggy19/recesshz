// Ground-truth probe: does PongPlay actually apply LEFT/RIGHT movement to the
// ball (and vertical movement to the paddles) as the game state advances?
import { describe, expect, test, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { createRoot } from "react-dom/client";
import { act } from "react";

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  navigator: globalThis.navigator,
  localStorage: globalThis.localStorage,
  crypto: globalThis.crypto,
  matchMedia: globalThis.matchMedia,
  ResizeObserver: globalThis.ResizeObserver,
};
afterAll(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value !== undefined) (globalThis as Record<string, unknown>)[key] = value;
    else delete (globalThis as Record<string, unknown>)[key];
  }
});

const dom = new Window({ url: "https://playrecess.freebuff.app/play/room-abc" });
Object.assign(globalThis, {
  window: dom as unknown as Window & typeof globalThis,
  document: dom.document as unknown as Document,
  navigator: dom.navigator as unknown as Navigator,
  localStorage: dom.localStorage,
  crypto: dom.crypto,
  matchMedia: (q: string) => dom.matchMedia(q),
});

// Radix slider measures its track with ResizeObserver — stub it for happy-dom.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub;

const { default: PongPlay } = await import("../src/components/games/PongPlay");

const freshPong = {
  phase: "serve",
  turn: "X",
  serve: null,
  scores: { X: 0, O: 0 },
  lastPoint: null,
  matchWinner: null,
};

function styles(container: HTMLElement) {
  const ball = container.querySelector(".size-\\[18px\\]");
  const paddles = container.querySelectorAll(".rounded-full.bg-\\[\\#1A1A1A\\]");
  return {
    ballLeft: ball ? (ball as HTMLElement).style.left : "MISSING",
    ballTop: ball ? (ball as HTMLElement).style.top : "MISSING",
    paddleTops: Array.from(paddles).map((p) => (p as HTMLElement).style.top),
  };
}

async function render(state: Record<string, unknown>, status = "in_progress", myMarker = "X") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <PongPlay
        state={state as never}
        status={status as never}
        myMarker={myMarker as never}
        onShot={async () => true}
      />,
    );
  });
  return { container, root };
}

describe("pong motion", () => {
  test("the ball travels left-to-right on serve and right-to-left on the reply", async () => {
    // X about to serve: ball rests on the LEFT (X's side).
    const a = await render(freshPong);
    const preServe = styles(a.container);
    expect(preServe.ballLeft).toBe("6%");
    act(() => a.root.unmount());

    // X serves 30°: ball flies to the RIGHT (O's side) at the serve's height.
    const b = await render({ ...freshPong, phase: "return", turn: "O", serve: { angle: 30, power: 2 } });
    const inFlight = styles(b.container);
    expect(inFlight.ballLeft).toBe("88%");
    expect(inFlight.ballTop).toBe("calc(66.5% - 9px)"); // 50 + 30*0.55
    act(() => b.root.unmount());

    // O returns and wins the point: O serves next, ball rests RIGHT (O's side).
    const c = await render(
      {
        ...freshPong,
        phase: "point_over",
        turn: "O",
        scores: { X: 0, O: 1 },
        lastPoint: { winner: "O", serve: { angle: 30, power: 1 }, ret: { angle: -30, power: 1 }, good: true },
      },
      "in_progress",
      "O",
    );
    const rest = styles(c.container);
    expect(rest.ballLeft).toBe("88%");
    expect(rest.ballTop).toBe("calc(50% - 9px)");
    act(() => c.root.unmount());

    // O serves -15°: the ball travels to the LEFT (X is now the returner).
    const d = await render(
      { ...freshPong, turn: "X", phase: "return", serve: { angle: -15, power: 1 } },
      "in_progress",
      "O",
    );
    const flightBack = styles(d.container);
    expect(flightBack.ballLeft).toBe("6%");
    act(() => d.root.unmount());

    // And when the server wins the point, the ball travels back to their side.
    const e = await render(
      {
        ...freshPong,
        phase: "point_over",
        turn: "X",
        scores: { X: 1, O: 0 },
        lastPoint: { winner: "X", serve: { angle: 30, power: 1 }, ret: { angle: 20, power: 1 }, good: false },
      },
      "in_progress",
      "X",
    );
    const backHome = styles(e.container);
    expect(backHome.ballLeft).toBe("6%");
    act(() => e.root.unmount());
  });

  test("paddles move vertically with the angle (top changes, left/right fixed)", async () => {
    const a = await render(freshPong);
    const before = styles(a.container);
    act(() => a.root.unmount());

    const b = await render({ ...freshPong, phase: "return", turn: "O", serve: { angle: -45, power: 1 } });
    const after = styles(b.container);
    act(() => b.root.unmount());

    // X's paddle tracks the serve launch height; O's returns to center.
    expect(before.paddleTops.join() !== after.paddleTops.join()).toBe(true);
  });
});
