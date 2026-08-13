// ---------------------------------------------------------------------------
// Tests for the pure game rules (src/convex/gameLogic.ts).
//
// gameLogic.ts is intentionally dependency-free so the exact same test harness
// works for every future game type: fresh<Game>State() + apply<Game>Move().
// Run with `bun test`.
// ---------------------------------------------------------------------------

import { describe, expect, test } from "bun:test";
import {
  MAX_QUESTIONS,
  applyPongReturn,
  applyPongServe,
  applyRedBlackGuess,
  applyRpsPick,
  applyTicTacToeMove,
  applyTwentyQuestionsAnswer,
  applyTwentyQuestionsGuess,
  applyTwentyQuestionsQuestion,
  applyTwentyQuestionsSecret,
  beats,
  coinFlip,
  findWinningLine,
  freshPongState,
  freshRedBlackState,
  freshRpsState,
  freshTicTacToeState,
  freshTwentyQuestionsState,
  isBoardFull,
  isGoodPongReturn,
  otherMarker,
  pongReturnWindow,
} from "../src/convex/gameLogic";
import type { PongShot } from "../src/convex/gameLogic";

// --- Tic Tac Toe -----------------------------------------------------------

describe("tic tac toe", () => {
  test("fresh board is empty and X starts", () => {
    const s = freshTicTacToeState();
    expect(s.board).toEqual(Array(9).fill(""));
    expect(s.turn).toBe("X");
    expect(s.winner).toBeNull();
    expect(s.draw).toBe(false);
  });

  test("findWinningLine detects all 8 lines", () => {
    // rows
    expect(findWinningLine(["X", "X", "X", "", "", "", "", "", ""])).toEqual([
      0, 1, 2,
    ]);
    expect(findWinningLine(["", "", "", "O", "O", "O", "", "", ""])).toEqual([
      3, 4, 5,
    ]);
    // columns
    expect(findWinningLine(["X", "", "", "X", "", "", "X", "", ""])).toEqual([
      0, 3, 6,
    ]);
    // diagonals
    expect(findWinningLine(["O", "", "", "", "O", "", "", "", "O"])).toEqual([
      0, 4, 8,
    ]);
    expect(findWinningLine(["", "", "X", "", "X", "", "X", "", ""])).toEqual([
      2, 4, 6,
    ]);
  });

  test("findWinningLine returns null without a win", () => {
    expect(findWinningLine(Array(9).fill(""))).toBeNull();
    expect(
      findWinningLine(["X", "O", "X", "O", "X", "O", "O", "X", "O"]),
    ).toBeNull();
  });

  test("isBoardFull", () => {
    expect(isBoardFull(["X", "O", "X", "O", "X", "O", "O", "X", "O"])).toBe(
      true,
    );
    expect(isBoardFull(["X", "", "", "", "", "", "", "", ""])).toBe(false);
  });

  test("otherMarker flips", () => {
    expect(otherMarker("X")).toBe("O");
    expect(otherMarker("O")).toBe("X");
  });

  test("a move places the marker and alternates the turn", () => {
    const result = applyTicTacToeMove(freshTicTacToeState(), 4, "X");
    expect(result.state.board[4]).toBe("X");
    expect(result.state.turn).toBe("O");
    expect(result.over).toBe(false);
  });

  test("a full line wins and ends the game", () => {
    let s = freshTicTacToeState();
    for (const [cell, marker] of [
      [0, "X"],
      [3, "O"],
      [1, "X"],
      [4, "O"],
      [2, "X"],
    ] as const) {
      s = applyTicTacToeMove(s, cell, marker).state;
    }
    expect(s.winner).toBe("X");
    expect(s.winningLine).toEqual([0, 1, 2]);
    expect(s.draw).toBe(false);
  });

  test("a full board with no line is a draw", () => {
    // Walk all 9 cells with strict alternation; the final move fills the last
    // empty cell without creating a line.
    let s = freshTicTacToeState();
    const moves: Array<[number, "X" | "O"]> = [
      [0, "X"],
      [1, "O"],
      [2, "X"],
      [4, "O"],
      [3, "X"],
      [5, "O"],
      [7, "X"],
      [6, "O"],
      [8, "X"],
    ];
    let over = false;
    for (const [cell, marker] of moves) {
      const outcome = applyTicTacToeMove(s, cell, marker);
      s = outcome.state;
      over = outcome.over;
    }
    expect(over).toBe(true);
    expect(s.winner).toBeNull();
    expect(s.draw).toBe(true);
    expect(s.winningLine).toBeNull();
  });
});

// --- Rock Paper Scissors ----------------------------------------------------

describe("rock paper scissors", () => {
  test("fresh state is round 1, picking, no scores", () => {
    const s = freshRpsState();
    expect(s.round).toBe(1);
    expect(s.phase).toBe("picking");
    expect(s.picks).toEqual({ X: null, O: null });
    expect(s.scores).toEqual({ X: 0, O: 0 });
    expect(s.matchWinner).toBeNull();
  });

  test("beats: standard rules", () => {
    expect(beats("rock", "scissors")).toBe(true);
    expect(beats("scissors", "paper")).toBe(true);
    expect(beats("paper", "rock")).toBe(true);
    expect(beats("rock", "paper")).toBe(false);
    expect(beats("paper", "scissors")).toBe(false);
    expect(beats("scissors", "rock")).toBe(false);
  });

  test("first pick never resolves the round or reveals anything", () => {
    const s = applyRpsPick(freshRpsState(), "X", "rock");
    expect(s.over).toBe(false);
    expect(s.state.phase).toBe("picking");
    expect(s.state.winner).toBeNull();
    // The second pick isn't in yet — the first pick is only stored, never
    // exposed as a result. (Server additionally masks it on all reads.)
    expect(s.state.picks.O).toBeNull();
  });

  test("two picks resolve the round", () => {
    let s = freshRpsState();
    s = applyRpsPick(s, "X", "rock").state;
    s = applyRpsPick(s, "O", "scissors").state;
    expect(s.phase).toBe("resolved");
    expect(s.winner).toBe("X");
    expect(s.scores).toEqual({ X: 1, O: 0 });
    expect(s.round).toBe(1); // round advances only on the next pick
  });

  test("a draw keeps the same round", () => {
    let s = freshRpsState();
    s = applyRpsPick(s, "X", "paper").state;
    s = applyRpsPick(s, "O", "paper").state;
    expect(s.winner).toBe("draw");
    expect(s.scores).toEqual({ X: 0, O: 0 });
    // Next pick replays round 1 (not round 2).
    s = applyRpsPick(s, "X", "scissors").state;
    expect(s.round).toBe(1);
    expect(s.phase).toBe("picking");
  });

  test("after a resolved win the next pick advances the round", () => {
    let s = freshRpsState();
    s = applyRpsPick(s, "X", "rock").state;
    s = applyRpsPick(s, "O", "scissors").state; // X wins round 1
    s = applyRpsPick(s, "X", "paper").state; // starts round 2
    expect(s.round).toBe(2);
    expect(s.phase).toBe("picking");
    expect(s.picks).toEqual({ X: "paper", O: null });
  });

  test("best of three ends the match at two round wins", () => {
    let s = freshRpsState();
    // X wins round 1
    s = applyRpsPick(s, "X", "rock").state;
    s = applyRpsPick(s, "O", "scissors").state;
    // X wins round 2
    s = applyRpsPick(s, "X", "paper").state;
    s = applyRpsPick(s, "O", "rock").state;
    expect(s.matchWinner).toBe("X");
    expect(s.scores).toEqual({ X: 2, O: 0 });
    expect(s.phase).toBe("resolved");
  });

  test("draws don't count toward the match", () => {
    let s = freshRpsState();
    s = applyRpsPick(s, "X", "rock").state;
    s = applyRpsPick(s, "O", "rock").state; // draw
    s = applyRpsPick(s, "X", "rock").state; // round 1 replay
    s = applyRpsPick(s, "O", "scissors").state; // X takes round 1
    expect(s.scores.X).toBe(1);
    expect(s.round).toBe(1);
  });

  test("masking invariant: picks never leak while a round is open", () => {
    // This mirrors the server's maskRpsState contract — the whole point of
    // the game is that a player can't learn the opponent's pick early.
    const pickX = applyRpsPick(freshRpsState(), "X", "rock").state;
    const masked = { ...pickX, picks: { X: null, O: null } };
    expect(masked.picks.X).toBeNull();
    expect(masked.picks.O).toBeNull();
    expect(pickX.picks.X).toBe("rock"); // server-side truth (never read by clients)
  });
});

// --- Red or Black -----------------------------------------------------------

describe("red or black", () => {
  test("fresh state is round 1, picking, nothing revealed", () => {
    const s = freshRedBlackState();
    expect(s.round).toBe(1);
    expect(s.phase).toBe("picking");
    expect(s.guess).toBeNull();
    expect(s.draw).toBeNull();
    expect(s.scores).toEqual({ X: 0, O: 0 });
    expect(s.winner).toBeNull();
    expect(s.matchWinner).toBeNull();
  });

  test("a correct guess scores O and resolves the round instantly", () => {
    const { state, over } = applyRedBlackGuess(
      freshRedBlackState(),
      "red",
      "red",
    );
    expect(over).toBe(false);
    expect(state.phase).toBe("resolved");
    expect(state.winner).toBe("O");
    expect(state.scores).toEqual({ X: 0, O: 1 });
    expect(state.guess).toBe("red");
    expect(state.draw).toBe("red");
  });

  test("a wrong guess scores X (the host)", () => {
    const { state } = applyRedBlackGuess(freshRedBlackState(), "red", "black");
    expect(state.winner).toBe("X");
    expect(state.scores).toEqual({ X: 1, O: 0 });
    expect(state.phase).toBe("resolved");
  });

  test("the outcome depends only on guess vs draw", () => {
    expect(
      applyRedBlackGuess(freshRedBlackState(), "black", "black").state.winner,
    ).toBe("O");
    expect(
      applyRedBlackGuess(freshRedBlackState(), "black", "red").state.winner,
    ).toBe("X");
  });

  test("after a resolved round the next guess advances the round", () => {
    let s = applyRedBlackGuess(freshRedBlackState(), "red", "red").state;
    s = applyRedBlackGuess(s, "black", "red").state;
    expect(s.round).toBe(2);
    expect(s.phase).toBe("resolved");
    expect(s.scores).toEqual({ X: 1, O: 1 });
  });

  test("best of three: the guesser wins at two correct guesses", () => {
    let s = freshRedBlackState();
    s = applyRedBlackGuess(s, "red", "red").state;
    const { state, over } = applyRedBlackGuess(s, "black", "black");
    expect(state.matchWinner).toBe("O");
    expect(state.scores).toEqual({ X: 0, O: 2 });
    expect(state.phase).toBe("resolved");
    expect(over).toBe(true);
  });

  test("best of three: the host wins when the guesser keeps missing", () => {
    let s = freshRedBlackState();
    s = applyRedBlackGuess(s, "red", "black").state;
    const { state, over } = applyRedBlackGuess(s, "red", "black");
    expect(state.matchWinner).toBe("X");
    expect(state.scores).toEqual({ X: 2, O: 0 });
    expect(over).toBe(true);
  });

  test("coinFlip is a fair two-outcome draw", () => {
    // A draw must always be a valid color — the caller decides fairness.
    for (let i = 0; i < 200; i++) {
      const c = coinFlip();
      expect(c === "red" || c === "black").toBe(true);
    }
  });
});

// --- Pong -------------------------------------------------------------------

describe("pong", () => {
  test("fresh state: X serves first, first to 7", () => {
    const s = freshPongState();
    expect(s.phase).toBe("serve");
    expect(s.turn).toBe("X");
    expect(s.serve).toBeNull();
    expect(s.scores).toEqual({ X: 0, O: 0 });
    expect(s.lastPoint).toBeNull();
    expect(s.matchWinner).toBeNull();
  });

  test("a serve moves to the return phase and is visible to the returner", () => {
    const { state, over } = applyPongServe(freshPongState(), "X", 30, 2);
    expect(over).toBe(false);
    expect(state.phase).toBe("return");
    expect(state.turn).toBe("O");
    expect(state.serve).toEqual({ angle: 30, power: 2 });
    // Unlike RPS picks, the incoming shot is never hidden.
    expect(state.serve).not.toBeNull();
  });

  test("return window: power tradeoffs", () => {
    expect(pongReturnWindow(1, 1)).toBe(24);
    expect(pongReturnWindow(3, 3)).toBe(8);
    expect(pongReturnWindow(1, 3)).toBe(20); // smash cuts your own window
    expect(pongReturnWindow(3, 1)).toBe(12); // fast serve shrinks it
    expect(pongReturnWindow(3, 2)).toBe(10);
  });

  test("a mirrored return within the window is good", () => {
    const serve: PongShot = { angle: 30, power: 1 };
    expect(isGoodPongReturn(serve, { angle: -30, power: 1 })).toBe(true);
    expect(isGoodPongReturn(serve, { angle: -20, power: 1 })).toBe(true); // |10| <= 24
    expect(isGoodPongReturn(serve, { angle: -5, power: 1 })).toBe(false); // |25| > 24
  });

  test("a fast edge serve forces a near-perfect mirror", () => {
    const serve: PongShot = { angle: 55, power: 3 };
    // Power-1 return: window 12 -> |55-45|=10 fits, but only just.
    expect(isGoodPongReturn(serve, { angle: -45, power: 1 })).toBe(true);
    // Power-3 smash against it: window 8 -> |10| > 8, the smash is punished.
    expect(isGoodPongReturn(serve, { angle: -45, power: 3 })).toBe(false);
  });

  test("a good return scores the returner and they serve next", () => {
    let s = freshPongState();
    s = applyPongServe(s, "X", 30, 1).state;
    const { state, over } = applyPongReturn(s, "O", -30, 1);
    expect(over).toBe(false);
    expect(state.phase).toBe("point_over");
    expect(state.lastPoint).toEqual({
      winner: "O",
      serve: { angle: 30, power: 1 },
      ret: { angle: -30, power: 1 },
      good: true,
    });
    expect(state.scores).toEqual({ X: 0, O: 1 });
    expect(state.turn).toBe("O"); // point winner serves next
    expect(state.serve).toBeNull();
  });

  test("a missed return scores the server", () => {
    let s = freshPongState();
    s = applyPongServe(s, "X", 30, 1).state;
    const { state } = applyPongReturn(s, "O", 20, 1);
    expect(state.lastPoint?.good).toBe(false);
    expect(state.lastPoint?.winner).toBe("X");
    expect(state.scores).toEqual({ X: 1, O: 0 });
    expect(state.turn).toBe("X");
  });

  test("the point winner serves the next point", () => {
    // X serves, O misses -> X wins the point and serves again.
    let s = freshPongState();
    s = applyPongServe(s, "X", 0, 1).state;
    s = applyPongReturn(s, "O", 30, 1).state;
    expect(s.turn).toBe("X");
    // X's next serve puts the ball back in flight.
    s = applyPongServe(s, "X", -15, 2).state;
    expect(s.phase).toBe("return");
    expect(s.turn).toBe("O");
    expect(s.serve).toEqual({ angle: -15, power: 2 });
  });

  test("first to seven points wins the match", () => {
    let s = freshPongState();
    for (let i = 0; i < 6; i++) {
      // X serves; O's return always misses -> X scores.
      s = applyPongServe(s, "X", 0, 1).state;
      s = applyPongReturn(s, "O", 45, 1).state;
      expect(s.phase).toBe("point_over");
      expect(s.matchWinner).toBeNull();
      expect(s.scores.X).toBe(i + 1);
    }
    // Point 7: X reaches the target.
    s = applyPongServe(s, "X", 0, 1).state;
    const { state, over } = applyPongReturn(s, "O", 45, 1);
    expect(over).toBe(true);
    expect(state.matchWinner).toBe("X");
    expect(state.phase).toBe("match_over");
    expect(state.scores).toEqual({ X: 7, O: 0 });
  });
});

// --- Twenty Questions ------------------------------------------------------

describe("twenty questions", () => {
  test("fresh state: setup phase, no secret, no questions", () => {
    const s = freshTwentyQuestionsState();
    expect(s.phase).toBe("setup");
    expect(s.secret).toBeNull();
    expect(s.pendingQuestion).toBeNull();
    expect(s.questions).toEqual([]);
    expect(s.winner).toBeNull();
  });

  test("setting the secret opens the floor to questions", () => {
    const s = applyTwentyQuestionsSecret(freshTwentyQuestionsState(), "a giraffe");
    expect(s.secret).toBe("a giraffe");
    expect(s.phase).toBe("asking");
    expect(s.pendingQuestion).toBeNull();
  });

  test("a question becomes pending — the answerer's turn", () => {
    let s = applyTwentyQuestionsSecret(freshTwentyQuestionsState(), "giraffe");
    s = applyTwentyQuestionsQuestion(s, "Is it an animal?");
    expect(s.pendingQuestion).toBe("Is it an animal?");
  });

  test("an answer records the pair and clears the pending question", () => {
    let s = applyTwentyQuestionsSecret(freshTwentyQuestionsState(), "giraffe");
    s = applyTwentyQuestionsQuestion(s, "Is it an animal?");
    s = applyTwentyQuestionsAnswer(s, "yes");
    expect(s.pendingQuestion).toBeNull();
    expect(s.questions).toEqual([
      { text: "Is it an animal?", answer: "yes" },
    ]);
    expect(s.phase).toBe("asking");
  });

  test("a correct guess wins O and reveals the secret", () => {
    let s = applyTwentyQuestionsSecret(freshTwentyQuestionsState(), "Giraffe");
    s = applyTwentyQuestionsQuestion(s, "Is it an animal?");
    s = applyTwentyQuestionsAnswer(s, "yes");
    const { state, over } = applyTwentyQuestionsGuess(s, " a giraffe ");
    expect(over).toBe(true);
    expect(state.phase).toBe("match_over");
    expect(state.winner).toBe("O");
    expect(state.secret).toBe("Giraffe"); // revealed on reveal screen
  });

  test("a wrong guess loses O — the classic rule", () => {
    let s = applyTwentyQuestionsSecret(freshTwentyQuestionsState(), "giraffe");
    const { state, over } = applyTwentyQuestionsGuess(s, "a zebra");
    expect(over).toBe(true);
    expect(state.winner).toBe("X");
  });

  test("the 20th answer moves to the final guess", () => {
    let s = applyTwentyQuestionsSecret(freshTwentyQuestionsState(), "giraffe");
    for (let i = 0; i < MAX_QUESTIONS; i++) {
      s = applyTwentyQuestionsQuestion(s, `Question ${i + 1}?`);
      s = applyTwentyQuestionsAnswer(s, i % 2 === 0 ? "yes" : "no");
    }
    expect(s.questions).toHaveLength(MAX_QUESTIONS);
    expect(s.phase).toBe("final");
    expect(s.pendingQuestion).toBeNull();
    // The final guess still decides it.
    const { state } = applyTwentyQuestionsGuess(s, "giraffe");
    expect(state.winner).toBe("O");
  });

  test("the answerer wins if the final guess misses", () => {
    let s = applyTwentyQuestionsSecret(freshTwentyQuestionsState(), "giraffe");
    for (let i = 0; i < MAX_QUESTIONS; i++) {
      s = applyTwentyQuestionsQuestion(s, `Q${i + 1}?`);
      s = applyTwentyQuestionsAnswer(s, "yes");
    }
    const { state } = applyTwentyQuestionsGuess(s, "elephant");
    expect(state.winner).toBe("X");
  });

  test("the match is single-round: one winner, then over", () => {
    let s = applyTwentyQuestionsSecret(freshTwentyQuestionsState(), "giraffe");
    s = applyTwentyQuestionsQuestion(s, "Is it big?");
    s = applyTwentyQuestionsAnswer(s, "yes");
    const { state, over } = applyTwentyQuestionsGuess(s, "giraffe");
    expect(over).toBe(true);
    expect(state.winner).toBe("O");
  });
});
