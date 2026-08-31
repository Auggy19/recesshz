import { useCallback, useEffect, useRef, useState } from "react";
import type { Difficulty } from "@/lib/design-tokens";
import {
  applyTicTacToeMove,
  freshTicTacToeState,
  type TicTacToeState,
  type Marker,
} from "@/lib/gameLogic";
import { chooseTicTacToeMove, aiThinkDelayMs } from "@/lib/ai";
import { playCelebration } from "@/lib/audio/celebration";

/** Local single-player Tic-Tac-Toe vs AI. Human is always X; AI is O. */
export function useSinglePlayerTicTacToe(difficulty: Difficulty) {
  const [state, setState] = useState<TicTacToeState>(() => freshTicTacToeState());
  const [thinking, setThinking] = useState(false);
  const lock = useRef(false);

  const reset = useCallback(() => {
    lock.current = false;
    setThinking(false);
    setState(freshTicTacToeState());
  }, []);

  const humanMove = useCallback(
    (cell: number) => {
      if (lock.current || thinking) return;
      setState((prev) => {
        if (prev.winner || prev.draw || prev.turn !== "X") return prev;
        if (prev.board[cell] !== "") return prev;
        lock.current = true;
        const { state: next, over } = applyTicTacToeMove(prev, cell, "X");
        if (over) {
          lock.current = false;
          void playCelebration(
            next.winner === "X" ? "win" : next.draw ? "draw" : "lose",
          );
        }
        return next;
      });
    },
    [thinking],
  );

  useEffect(() => {
    if (state.winner || state.draw || state.turn !== "O") return;
    let cancelled = false;
    setThinking(true);
    const t = window.setTimeout(() => {
      if (cancelled) return;
      const cell = chooseTicTacToeMove(state.board, "O" as Marker, difficulty);
      setState((prev) => {
        if (prev.turn !== "O" || prev.board[cell] !== "") return prev;
        const { state: next, over } = applyTicTacToeMove(prev, cell, "O");
        if (over) {
          void playCelebration(
            next.winner === "X" ? "win" : next.draw ? "draw" : "lose",
          );
        }
        return next;
      });
      lock.current = false;
      setThinking(false);
    }, aiThinkDelayMs(difficulty));
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [state, difficulty]);

  return { state, thinking, humanMove, reset };
}
