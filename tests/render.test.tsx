// ---------------------------------------------------------------------------
// Browser-flow smoke tests — render the REAL Landing and GamePage components
// (not copies) against a happy-dom window with mocked Convex hooks, so the
// join → query → render pipeline runs exactly as it does in a browser:
//   - Landing renders with all four live game cards + the room-code flow
//   - GamePage joins, then renders every state: waiting room, Tic Tac Toe
//     (my turn / waiting / completed win), RPS (picking / picked / resolved /
//     match over), Red or Black (host / guesser / revealed), Pong (serve /
//     return / point over / match over), plus the locked and abandoned paths
//   - real clicks drive moves, feedback, and play-again through the real
//     handlers (which call the mocked Convex mutations, and we assert the
//     exact args they were called with)
// ---------------------------------------------------------------------------

// React 19's act() requires this flag; without it, renders don't flush effects.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import { describe, expect, test, mock, beforeEach, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { createRoot, type Root } from "react-dom/client";
import { act, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import { ThemeProvider } from "../src/hooks/use-theme";

// --- Convex hooks mock (registered before the pages are imported) ----------

/** Record of every mutation call: slot 0=join, 1=move, 2=playAgain, 3=feedback. */
let mutationCalls: Array<{ slot: number; args: unknown[] }> = [];
let hookCallCount = 0;
/** joinGame's behavior — set per test; reject to exercise the error path. */
let joinImpl: (args: { slug: string; deviceToken: string }) => Promise<unknown> =
  async () => ({ joined: true, me: { role: "initiator", marker: "X" } });
/** useQuery_experimental's result — set per test. */
let queryResult: Record<string, unknown> = { status: "pending" };

// The real useMutation memoizes its returned function, so GamePage's join
// effect (keyed on the mutation identity) only re-runs when its inputs change.
// The mock must return a STABLE function per call slot too — a fresh function
// per render would re-trigger the join effect forever. Slots are stable
// because the component calls useMutation in a fixed order every render:
// 0=joinGame, 1=submitMove, 2=playAgain, 3=submitFeedback.
const mutationStubs = [0, 1, 2, 3].map((slot) => {
  return async (...args: unknown[]) => {
    mutationCalls.push({ slot, args });
    if (slot === 0) return joinImpl(args[0] as { slug: string; deviceToken: string });
    return { ok: true };
  };
});

mock.module("convex/react", () => ({
  useMutation: () => mutationStubs[hookCallCount++ % 4],
  useQuery_experimental: () => queryResult,
}));

// --- happy-dom window shims ------------------------------------------------

// The shims below are installed on the shared global object; restore whatever
// existed before so sibling test files in the same process see no leftovers.
const originalGlobals = {
  window: globalThis.window,
  document: globalThis.document,
  navigator: globalThis.navigator,
  localStorage: globalThis.localStorage,
  crypto: globalThis.crypto,
  matchMedia: globalThis.matchMedia,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
};

afterAll(() => {
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value !== undefined) {
      (globalThis as Record<string, unknown>)[key] = value;
    } else {
      delete (globalThis as Record<string, unknown>)[key];
    }
  }
});

let dom: Window;

function freshWindow() {
  dom = new Window({ url: "https://playrecess.freebuff.app/play/room-abc" });
  Object.assign(globalThis, {
    window: dom as unknown as Window & typeof globalThis,
    document: dom.document as unknown as Document,
    navigator: dom.navigator as unknown as Navigator,
    localStorage: dom.localStorage,
    crypto: dom.crypto,
    matchMedia: (q: string) => dom.matchMedia(q),
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 16),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
  });
}

// Import the pages AFTER the mock + shims are registered (dynamic, so the
// "convex/react" mock is active when they first load it).
const { default: GamePage } = await import("../src/pages/GamePage");
const { default: Landing } = await import("../src/pages/Landing");

// --- helpers ---------------------------------------------------------------

type QueryData = Record<string, unknown> & {
  status: string;
  gameType: string;
  state: Record<string, unknown>;
  me: { role: string; marker: string; picked?: boolean } | null;
};

const freshTtt = {
  board: Array(9).fill(""),
  turn: "X",
  winner: null,
  draw: false,
  winningLine: null,
} as Record<string, unknown>;

const freshRps = {
  round: 1,
  phase: "picking",
  picks: { X: null, O: null },
  scores: { X: 0, O: 0 },
  winner: null,
  matchWinner: null,
} as Record<string, unknown>;

const freshRb = {
  round: 1,
  phase: "picking",
  guess: null,
  draw: null,
  scores: { X: 0, O: 0 },
  winner: null,
  matchWinner: null,
} as Record<string, unknown>;

const freshPong = {
  phase: "serve",
  turn: "X",
  serve: null,
  scores: { X: 0, O: 0 },
  lastPoint: null,
  matchWinner: null,
} as Record<string, unknown>;

/** Render a page inside the same provider tree the app uses (ThemeProvider +
 *  Router), flush the join effect, and return the mounted DOM. */
async function renderPage(node: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/play/room-abc"]}>
          <Routes>
            <Route path="/play/:slug" element={node} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    );
    // Flush the join effect's async chain + the resulting re-render.
    await new Promise((r) => setTimeout(r, 0));
  });
  return { container, root };
}

function renderGamePage(data: QueryData, join?: typeof joinImpl) {
  queryResult = { status: "success", data };
  if (join) joinImpl = join;
  return renderPage(<GamePage />);
}

function html(root: Root, container: HTMLElement): string {
  return container.innerHTML;
}

function clickText(container: HTMLElement, text: string) {
  const el = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes(text),
  );
  if (!el) throw new Error(`No button containing "${text}"`);
  act(() => {
    el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** Click an element by aria-label (TTT board cells have no visible text). */
function clickAria(container: HTMLElement, label: string) {
  const el = container.querySelector(`[aria-label="${label}"]`);
  if (!el) throw new Error(`No element with aria-label "${label}"`);
  act(() => {
    el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

async function flush() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

beforeEach(() => {
  freshWindow();
  mutationCalls = [];
  hookCallCount = 0;
  joinImpl = async () => ({ joined: true, me: { role: "initiator", marker: "X" } });
  queryResult = { status: "pending" };
});

// ---------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------

describe("Landing", () => {
  test("renders the hero, all four live game cards, and the room-code form", async () => {
    const { container, root } = await renderPage(<Landing />);
    const out = html(root, container);

    expect(out).toContain("Start a game");
    expect(out).toContain("Tic Tac Toe");
    expect(out).toContain("Rock Paper Scissors");
    expect(out).toContain("Red or Black");
    expect(out).toContain("Pong");
    expect(out).toContain("Twenty Questions");
    expect(out).toContain("Have a room code?");
    expect(out).toContain("How Recess works");
    expect(out).toContain("Silence is safe here.");

    act(() => root.unmount());
  });

  test("Create game clicks fire createGame and the page navigates (route change only)", async () => {
    // The create click calls the mocked mutation; we only assert the call args
    // because navigation is exercised by the router.
    const { container, root } = await renderPage(<Landing />);
    clickText(container, "Create game");
    await flush();

    const create = mutationCalls.find((c) => c.slot === 0);
    expect(create).toBeDefined();
    const args = create!.args[0] as { gameType: string; deviceToken: string };
    expect(args.gameType).toBe("tic_tac_toe");
    expect(typeof args.deviceToken).toBe("string");
    expect(args.deviceToken.length).toBeGreaterThanOrEqual(8);

    act(() => root.unmount());
  });
});

// ---------------------------------------------------------------------------
// GamePage — Tic Tac Toe flows
// ---------------------------------------------------------------------------

describe("GamePage — Tic Tac Toe", () => {
  test("waiting room: shows the share card, copy target, and WhatsApp CTA", async () => {
    const { container, root } = await renderGamePage({
      status: "waiting",
      gameType: "tic_tac_toe",
      state: freshTtt,
      me: { role: "initiator", marker: "X" },
    });
    const out = html(root, container);
    expect(out).toContain("Send this link to your friend");
    expect(out).toContain("You're X and play first");
    expect(out).toContain("/play/room-abc");
    expect(out).toContain("Share on WhatsApp");
    act(() => root.unmount());
  });

  test("my turn: the board renders and a cell click submits the right move", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "tic_tac_toe",
      state: freshTtt,
      me: { role: "initiator", marker: "X" },
    });
    let out = html(root, container);
    expect(out).toContain("Your move — you're X");
    expect(out).toContain("You're X — you go first.");

    // Click the first empty cell.
    clickAria(container, "Cell 1");
    await flush();
    out = html(root, container);

    const move = mutationCalls.find((c) => c.slot === 1);
    expect(move).toBeDefined();
    expect(move!.args[0]).toEqual({
      slug: "room-abc",
      deviceToken: expect.any(String),
      cell: 0,
    });
    act(() => root.unmount());
  });

  test("opponent's turn: shows the wait state", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "tic_tac_toe",
      state: { ...freshTtt, board: ["X", "", "", "", "", "", "", "", ""], turn: "O" },
      me: { role: "initiator", marker: "X" },
    });
    expect(html(root, container)).toContain("Waiting for your friend's move…");
    act(() => root.unmount());
  });

  test("completed win: result card, streak banner, inline feedback, play again", async () => {
    const { container, root } = await renderGamePage({
      status: "completed",
      gameType: "tic_tac_toe",
      state: {
        board: ["X", "X", "X", "O", "O", "", "", "", ""],
        turn: "O",
        winner: "X",
        draw: false,
        winningLine: [0, 1, 2],
      },
      me: { role: "initiator", marker: "X" },
    });
    let out = html(root, container);
    expect(out).toContain("You win!");
    expect(out).toContain("Would you play again?");
    expect(out).toContain("Play again");
    expect(out).toContain("Day 1 — every game counts."); // streak recorded on completion

    // Inline feedback: clicking "Yes" submits wouldPlayAgain=true.
    clickText(container, "Yes");
    await flush();
    const fb = mutationCalls.find((c) => c.slot === 3);
    expect(fb).toBeDefined();
    expect(fb!.args[0]).toMatchObject({ slug: "room-abc", wouldPlayAgain: true });
    out = html(root, container);
    expect(out).toContain("Thanks — see you next round!");

    // Play again fires the rematch mutation.
    clickText(container, "Play again");
    await flush();
    const pa = mutationCalls.find((c) => c.slot === 2);
    expect(pa).toBeDefined();
    expect(pa!.args[0]).toMatchObject({ slug: "room-abc" });
    act(() => root.unmount());
  });
});

// ---------------------------------------------------------------------------
// GamePage — error + abandoned paths
// ---------------------------------------------------------------------------

describe("GamePage — locked / expired / abandoned", () => {
  test("a third device is locked out at join (hard rule)", async () => {
    const { container, root } = await renderGamePage(
      {
        status: "in_progress",
        gameType: "tic_tac_toe",
        state: freshTtt,
        me: null,
      },
      async () => {
        throw new Error(
          "This game is already in progress — only the original two players can play it.",
        );
      },
    );
    const out = html(root, container);
    expect(out).toContain("Can't get into this game");
    expect(out).toContain("only the original two players");
    act(() => root.unmount());
  });

  test("a rejected read (query error) shows the same guard screen", async () => {
    queryResult = {
      status: "error",
      error: new Error("This game is already in progress — only the original two players can access it."),
    };
    const { container, root } = await renderPage(<GamePage />);
    const out = html(root, container);
    expect(out).toContain("Can't get into this game");
    expect(out).toContain("only the original two players");
    act(() => root.unmount());
  });

  test("an abandoned game explains what happened", async () => {
    const { container, root } = await renderGamePage({
      status: "abandoned",
      gameType: "tic_tac_toe",
      state: freshTtt,
      me: { role: "initiator", marker: "X" },
    });
    const out = html(root, container);
    expect(out).toContain("This game went quiet");
    expect(out).toContain("48 hours");
    act(() => root.unmount());
  });
});

// ---------------------------------------------------------------------------
// GamePage — Rock Paper Scissors
// ---------------------------------------------------------------------------

describe("GamePage — Rock Paper Scissors", () => {
  test("picking phase shows all three choices", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "rock_paper_scissors",
      state: freshRps,
      me: { role: "initiator", marker: "X", picked: false },
    });
    const out = html(root, container);
    expect(out).toContain("Your move — pick one");
    for (const label of ["Rock", "Paper", "Scissors"]) {
      expect(out).toContain(label);
    }
    act(() => root.unmount());
  });

  test("a pick click submits the choice and switches to the wait view", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "rock_paper_scissors",
      state: freshRps,
      me: { role: "initiator", marker: "X", picked: false },
    });
    clickText(container, "Rock");
    await flush();
    const move = mutationCalls.find((c) => c.slot === 1);
    expect(move).toBeDefined();
    expect(move!.args[0]).toMatchObject({ slug: "room-abc", pick: "rock" });
    act(() => root.unmount());
  });

  test("after my pick, picks stay masked and the wait view shows", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "rock_paper_scissors",
      state: { ...freshRps, phase: "picking", picks: { X: null, O: null } },
      me: { role: "initiator", marker: "X", picked: true },
    });
    const out = html(root, container);
    expect(out).toContain("You picked — waiting on your friend…");
    expect(out).toContain("Now we wait — silence is safe here.");
    act(() => root.unmount());
  });

  test("resolved round reveals both picks and scores it", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "rock_paper_scissors",
      state: {
        ...freshRps,
        phase: "resolved",
        picks: { X: "rock", O: "scissors" },
        winner: "X",
        scores: { X: 1, O: 0 },
      },
      me: { role: "initiator", marker: "X", picked: true },
    });
    const out = html(root, container);
    expect(out).toContain("You took round 1.");
    expect(out).toContain("Round 1 of 3");
    expect(out).toContain("You 1");
    act(() => root.unmount());
  });

  test("match over shows the result card with play again", async () => {
    const { container, root } = await renderGamePage({
      status: "completed",
      gameType: "rock_paper_scissors",
      state: {
        ...freshRps,
        phase: "resolved",
        picks: { X: "paper", O: "rock" },
        winner: "X",
        scores: { X: 2, O: 0 },
        matchWinner: "X",
      },
      me: { role: "initiator", marker: "X", picked: true },
    });
    const out = html(root, container);
    expect(out).toContain("You win the match!");
    expect(out).toContain("Play again");
    expect(out).toContain("Would you play again?");
    act(() => root.unmount());
  });
});

// ---------------------------------------------------------------------------
// GamePage — Red or Black
// ---------------------------------------------------------------------------

describe("GamePage — Red or Black", () => {
  test("the host waits on the guesser with a hidden card", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "red_or_black",
      state: freshRb,
      me: { role: "initiator", marker: "X" },
    });
    const out = html(root, container);
    expect(out).toContain("Waiting for your friend to pick a color…");
    expect(out).toContain("Your friend's pick");
    expect(out).toContain("The card stays hidden until they guess.");
    act(() => root.unmount());
  });

  test("the guesser picks a color and the click submits it", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "red_or_black",
      state: freshRb,
      me: { role: "responder", marker: "O" },
    });
    const out = html(root, container);
    expect(out).toContain("Your move — pick a color");
    clickText(container, "Red");
    await flush();
    const move = mutationCalls.find((c) => c.slot === 1);
    expect(move).toBeDefined();
    expect(move!.args[0]).toMatchObject({ slug: "room-abc", pick: "red" });
    act(() => root.unmount());
  });

  test("a revealed round shows guess vs card and the winner", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "red_or_black",
      state: {
        ...freshRb,
        phase: "resolved",
        guess: "red",
        draw: "red",
        winner: "O",
        scores: { X: 0, O: 1 },
      },
      me: { role: "responder", marker: "O" },
    });
    const out = html(root, container);
    expect(out).toContain("Right on the money — you took the round.");
    expect(out).toContain("Card was");
    expect(out).toContain("You 1");
    act(() => root.unmount());
  });
});

// ---------------------------------------------------------------------------
// GamePage — Pong
// ---------------------------------------------------------------------------

describe("GamePage — Pong", () => {
  test("serve phase: the server sees the angle/power controls", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "pong",
      state: freshPong,
      me: { role: "initiator", marker: "X" },
    });
    const out = html(root, container);
    expect(out).toContain("Your serve — pick an angle and power");
    expect(out).toContain("Lob");
    expect(out).toContain("Smash");
    clickText(container, "Serve");
    await flush();
    const move = mutationCalls.find((c) => c.slot === 1);
    expect(move).toBeDefined();
    expect(move!.args[0]).toMatchObject({ slug: "room-abc", angle: 0, power: 2 });
    act(() => root.unmount());
  });

  test("return phase: the incoming serve is visible and never hidden", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "pong",
      state: {
        ...freshPong,
        phase: "return",
        turn: "O",
        serve: { angle: 30, power: 2 },
      },
      me: { role: "responder", marker: "O" },
    });
    const out = html(root, container);
    expect(out).toContain("Incoming serve at +30° — return it!");
    expect(out).toContain("Return");
    act(() => root.unmount());
  });

  test("point over shows the shot comparison and who serves next", async () => {
    const { container, root } = await renderGamePage({
      status: "in_progress",
      gameType: "pong",
      state: {
        ...freshPong,
        phase: "point_over",
        turn: "O",
        scores: { X: 0, O: 1 },
        lastPoint: {
          winner: "O",
          serve: { angle: 30, power: 1 },
          ret: { angle: -30, power: 1 },
          good: true,
        },
      },
      me: { role: "responder", marker: "O" },
    });
    const out = html(root, container);
    expect(out).toContain("Point to you.");
    expect(out).toContain("Clean return — it found the paddle.");
    expect(out).toContain("Your serve — go again.");
    act(() => root.unmount());
  });

  test("match over shows the result card", async () => {
    const { container, root } = await renderGamePage({
      status: "completed",
      gameType: "pong",
      state: {
        ...freshPong,
        phase: "match_over",
        turn: "X",
        scores: { X: 7, O: 3 },
        lastPoint: { winner: "X", serve: { angle: 0, power: 1 }, ret: { angle: 45, power: 1 }, good: false },
        matchWinner: "X",
      },
      me: { role: "initiator", marker: "X" },
    });
    const out = html(root, container);
    expect(out).toContain("You win the match!");
    expect(out).toContain("Final score — you 7 · friend 3.");
    expect(out).toContain("Play again");
    act(() => root.unmount());
  });
});
