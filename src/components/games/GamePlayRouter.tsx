/**
 * Routes in-room play UI by game type.
 */
import TicTacToePlay, {
  type Marker,
  type TicTacToeState,
} from "@/components/games/TicTacToePlay";
import RpsPlay, { type RpsChoice } from "@/components/games/RpsPlay";
import RedBlackPlay, { type RedBlackChoice } from "@/components/games/RedBlackPlay";
import PongPlay, { type PongPower } from "@/components/games/PongPlay";
import TwentyQuestionsPlay, {
  type TwentyQuestionsMove,
} from "@/components/games/TwentyQuestionsPlay";
import HangmanPlay, { type HangmanMove } from "@/components/games/HangmanPlay";
import WordScramblePlay, {
  type WordScrambleMove,
} from "@/components/games/WordScramblePlay";
import CountersBallPlay from "@/components/games/CountersBallPlay";
import type { CountersBallState } from "@/lib/countersBall";
import TruthOrDarePlay from "@/components/games/TruthOrDarePlay";
import type { TodKind, TodState } from "@/lib/truthOrDare";

type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";

type Props = {
  gameType: string;
  status: GameStatus;
  myMarker: Marker;
  state: unknown;
  picked?: boolean;
  onCell: (cell: number) => void;
  onPick: (pick: string) => void;
  onPong: (angle: number, power: PongPower) => void;
  onTq: (move: TwentyQuestionsMove) => void;
  onHangman: (move: HangmanMove) => void;
  onScramble: (move: WordScrambleMove) => void;
  onTod?: (move: { action: "choose"; kind: TodKind } | { action: "done" } | { action: "skip" }) => void;
  liveConnected?: boolean;
  remoteAim?: number | null;
  onAimChange?: (angle: number) => void;
};

export function GamePlayRouter({
  gameType,
  status,
  myMarker,
  state,
  picked,
  onCell,
  onPick,
  onPong,
  onTq,
  onHangman,
  onScramble,
  onTod,
  liveConnected,
  remoteAim,
  onAimChange,
}: Props) {
  if (gameType === "rock_paper_scissors") {
    return (
      <RpsPlay
        state={state as never}
        status={status}
        myMarker={myMarker}
        picked={picked}
        onPick={onPick}
      />
    );
  }
  if (gameType === "red_or_black") {
    return (
      <RedBlackPlay
        state={state as never}
        status={status}
        myMarker={myMarker}
        onGuess={(g) => onPick(g)}
      />
    );
  }
  if (gameType === "pong") {
    return (
      <PongPlay
        state={state as never}
        status={status}
        myMarker={myMarker}
        onShot={onPong}
        liveConnected={liveConnected}
        remoteAim={remoteAim ?? null}
        onAimChange={onAimChange}
      />
    );
  }
  if (gameType === "twenty_questions") {
    return (
      <TwentyQuestionsPlay
        state={state as never}
        status={status}
        myMarker={myMarker}
        onSubmit={onTq}
      />
    );
  }
  if (gameType === "hangman") {
    return (
      <HangmanPlay
        state={state as never}
        status={status}
        myMarker={myMarker}
        onSubmit={onHangman}
      />
    );
  }
  if (gameType === "word_scramble") {
    return (
      <WordScramblePlay
        state={state as never}
        status={status}
        myMarker={myMarker}
        onSubmit={onScramble}
      />
    );
  }
  if (gameType === "truth_or_dare") {
    return (
      <TruthOrDarePlay
        state={state as TodState}
        status={status}
        myMarker={myMarker}
        onChoose={(kind) => onTod?.({ action: "choose", kind })}
        onDone={() => onTod?.({ action: "done" })}
        onSkip={() => onTod?.({ action: "skip" })}
      />
    );
  }
  if (gameType === "counters_ball") {
    return (
      <CountersBallPlay
        state={state as CountersBallState}
        status={status}
        myMarker={myMarker}
      />
    );
  }
  return (
    <TicTacToePlay
      state={state as TicTacToeState}
      status={status}
      myMarker={myMarker}
      onMove={onCell}
    />
  );
}

export function isGameOver(gameType: string, state: unknown): boolean {
  if (!state || typeof state !== "object") return false;
  const s = state as Record<string, unknown>;
  if (gameType === "counters_ball") {
    return s.phase === "gameover" || s.winner != null;
  }
  if (
    gameType === "rock_paper_scissors" ||
    gameType === "red_or_black" ||
    gameType === "pong" ||
    gameType === "truth_or_dare"
  ) {
    return s.matchWinner != null;
  }
  if (
    gameType === "twenty_questions" ||
    gameType === "hangman" ||
    gameType === "word_scramble"
  ) {
    return s.winner != null;
  }
  return s.winner != null || s.draw === true;
}

export function celebrationFor(
  gameType: string,
  state: unknown,
  myMarker: Marker | null,
): "win" | "loss" | "draw" | null {
  if (!isGameOver(gameType, state) || !myMarker) return null;
  const s = state as Record<string, unknown>;
  if (gameType === "counters_ball") {
    const myTeam = myMarker === "X" ? 0 : 1;
    if (s.winner == null) return "draw";
    return s.winner === myTeam ? "win" : "loss";
  }
  if (
    gameType === "rock_paper_scissors" ||
    gameType === "red_or_black" ||
    gameType === "pong" ||
    gameType === "truth_or_dare"
  ) {
    const w = s.matchWinner as Marker | null;
    if (!w) return "draw";
    return w === myMarker ? "win" : "loss";
  }
  if (gameType === "tic_tac_toe") {
    if (s.draw) return "draw";
    const w = s.winner as Marker | null;
    if (!w) return "draw";
    return w === myMarker ? "win" : "loss";
  }
  const w = s.winner as Marker | null;
  if (!w) return "draw";
  return w === myMarker ? "win" : "loss";
}
