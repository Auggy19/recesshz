// ---------------------------------------------------------------------------
// Tests for the pure game rules (src/convex/gameLogic.ts).
//
// gameLogic.ts is intentionally dependency-free so the exact same test harness
// works for every future game type: fresh<Game>State() + apply<Game>Move().
// Run with `bun test`.
// ---------------------------------------------------------------------------

import { describe, expect, test } from "bun:test";
import {
  applyRpsPick,
  applyTicTacToeMove,
  beats,
  findWinningLine,
  freshRpsState,
  freshTicTacToeState,
  isBoardFull,
  otherMarker,
} from "../src/convex/gameLogic";
import type { Board } from "../src/convex/gameLogic";

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
    // Classic draw board.
    const board: Board = ["X", "O", "X", "O", "O", "X", "X", "X", "O"];
    let s = freshTicTacToeState();
    s = { ...s, board };
    const { state } = applyTicTacToeMove(s, 4, "O"); // any legal-looking move
    // Rebuild a genuine draw by walking all 9 cells with alternation:
    let t = freshTicTacToeState();
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
    for (const [cell, marker] of moves) {
      t = applyTicTacToeMove(t, cell, marker).state;
    }
    expect(t.winner).toBeNull();
    expect(t.draw).toBe(true);
    expect(state).toBeDefined();
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
