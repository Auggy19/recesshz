import { useCallback, useEffect, useRef, useState } from "react";
import type { Difficulty } from "@/lib/design-tokens";
import {
  applyTicTacToeMove,
  applyRpsPick,
  applyRedBlackGuess,
  applyPongServe,
  applyPongReturn,
  freshTicTacToeState,
  freshRpsState,
  freshRedBlackState,
  freshPongState,
  coinFlip,
  type TicTacToeState,
  type RpsState,
  type RpsChoice,
  type RedBlackState,
  type RedBlackChoice,
  type PongState,
  type PongPower,
  type Marker,
  RPS_CHOICES,
} from "@/lib/gameLogic";
import {
  chooseTicTacToeMove,
  chooseRpsPick,
  choosePongShot,
  aiThinkDelayMs,
} from "@/lib/ai";
import { playCelebration } from "@/lib/celebration";

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
            next.winner === "X" ? "win" : next.draw ? "draw" : "loss",
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
            next.winner === "X" ? "win" : next.draw ? "draw" : "loss",
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

/** Best-of-3 RPS vs AI. Human is X. */
export function useSinglePlayerRps(difficulty: Difficulty) {
  const [state, setState] = useState<RpsState>(() => freshRpsState());
  const [thinking, setThinking] = useState(false);

  const reset = useCallback(() => {
    setThinking(false);
    setState(freshRpsState());
  }, []);

  const humanPick = useCallback(
    (pick: RpsChoice) => {
      if (thinking || state.matchWinner) return;
      setState((prev) => applyRpsPick(prev, "X", pick).state);
      setThinking(true);
      window.setTimeout(() => {
        const aiPick = chooseRpsPick(difficulty, pick);
        setState((prev) => {
          const { state: next, over } = applyRpsPick(prev, "O", aiPick);
          if (over) {
            void playCelebration(next.matchWinner === "X" ? "win" : "loss");
          } else if (next.phase === "resolved") {
            void playCelebration("point");
          }
          return next;
        });
        setThinking(false);
      }, aiThinkDelayMs(difficulty));
    },
    [difficulty, thinking, state.matchWinner],
  );

  return { state, thinking, humanPick, reset, choices: RPS_CHOICES };
}

/** Red/Black: human (O) guesses vs house card. */
export function useSinglePlayerRedBlack(difficulty: Difficulty) {
  const [state, setState] = useState<RedBlackState>(() => freshRedBlackState());

  const reset = useCallback(() => setState(freshRedBlackState()), []);

  const humanGuess = useCallback(
    (guess: RedBlackChoice) => {
      if (state.matchWinner) return;
      let draw = coinFlip();
      if (difficulty === "beginner" && Math.random() < 0.35) draw = guess;
      if (difficulty === "expert" && Math.random() < 0.35) {
        draw = guess === "red" ? "black" : "red";
      }
      const { state: next, over } = applyRedBlackGuess(state, guess, draw);
      setState(next);
      if (over) {
        void playCelebration(next.matchWinner === "O" ? "win" : "loss");
      } else if (next.phase === "resolved") {
        void playCelebration("point");
      }
    },
    [state, difficulty],
  );

  return { state, humanGuess, reset };
}

/** Solo Pong: human X serves/returns vs AI. */
export function useSinglePlayerPong(difficulty: Difficulty) {
  const [state, setState] = useState<PongState>(() => freshPongState());
  const [thinking, setThinking] = useState(false);

  const reset = useCallback(() => {
    setThinking(false);
    setState(freshPongState());
  }, []);

  const playShot = useCallback(
    (angle: number, power: PongPower) => {
      if (thinking || state.matchWinner) return;
      if (state.phase === "serve" && state.turn === "X") {
        const { state: next } = applyPongServe(state, "X", angle, power);
        setState(next);
        setThinking(true);
        window.setTimeout(() => {
          const shot = choosePongShot(difficulty, "return", angle);
          setState((prev) => {
            if (prev.phase !== "return" || !prev.serve) return prev;
            const { state: after, over } = applyPongReturn(
              prev,
              "O",
              shot.angle,
              shot.power,
            );
            if (over) {
              void playCelebration(after.matchWinner === "X" ? "win" : "loss");
            } else {
              void playCelebration("point");
            }
            return after;
          });
          setThinking(false);
        }, aiThinkDelayMs(difficulty));
        return;
      }
      if (state.phase === "return" && state.turn === "X" && state.serve) {
        const { state: next, over } = applyPongReturn(state, "X", angle, power);
        setState(next);
        if (over) {
          void playCelebration(next.matchWinner === "X" ? "win" : "loss");
        } else {
          void playCelebration("point");
        }
        if (!over && next.phase === "point_over" && next.turn === "O") {
          setThinking(true);
          window.setTimeout(() => {
            const shot = choosePongShot(difficulty, "serve", 0);
            setState((prev) => {
              const served = applyPongServe(
                { ...prev, phase: "serve", turn: "O", serve: null },
                "O",
                shot.angle,
                shot.power,
              ).state;
              return served;
            });
            setThinking(false);
          }, aiThinkDelayMs(difficulty));
        }
      }
    },
    [state, difficulty, thinking],
  );

  const continuePoint = useCallback(() => {
    setState((prev) => {
      if (prev.phase !== "point_over" || prev.matchWinner) return prev;
      return {
        ...prev,
        phase: "serve",
        serve: null,
        lastPoint: prev.lastPoint,
      };
    });
  }, []);

  return { state, thinking, playShot, reset, continuePoint };
}
