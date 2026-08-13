import { cn } from "@/lib/utils";
import { OMark, XMark } from "@/components/GameArt";

// ---------------------------------------------------------------------------
// Tic Tac Toe play area — status line, 3x3 board, and caption. All moves are
// validated server-side; the client only renders what the server tells us.
// ---------------------------------------------------------------------------

export type Marker = "X" | "O";
export type Cell = "" | Marker;
export type Board = Cell[];
export type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";

export interface TicTacToeState {
  board: Board;
  turn: Marker;
  winner: Marker | null;
  draw: boolean;
  winningLine: number[] | null;
  rematch?: { slug: string; by: string };
}

interface Props {
  state: TicTacToeState;
  status: GameStatus;
  myMarker: Marker;
  onMove: (cell: number) => void;
}

export default function TicTacToePlay({ state, status, myMarker, onMove }: Props) {
  const isWaiting = status === "waiting";
  const isOver = state.winner !== null || state.draw;
  const isMyTurn = status === "in_progress" && !isOver && state.turn === myMarker;

  const resultTitle = state.winner
    ? state.winner === myMarker
      ? "You win!"
      : "Your friend wins"
    : state.draw
      ? "It's a draw"
      : "";

  return (
    <>
      {/* Status line */}
      <div className="flex items-center justify-center gap-2 text-center">
        <span
          className={cn(
            "size-2 rounded-full",
            isMyTurn || isWaiting
              ? "animate-pulse bg-primary"
              : "bg-muted-foreground/40",
          )}
        />
        <p className="text-sm font-semibold text-muted-foreground">
          {isWaiting
            ? "Waiting for your friend to join…"
            : isOver
              ? resultTitle
              : isMyTurn
                ? `Your move — you're ${myMarker}`
                : "Waiting for your friend's move…"}
        </p>
      </div>

      {/* Board */}
      <div className={cn("mx-auto mt-6 w-full max-w-xs", isWaiting && "opacity-60")}>
        <div className="grid grid-cols-3 gap-2">
          {state.board.map((cell, i) => {
            const inWinningLine = state.winningLine?.includes(i) ?? false;
            const disabled = isWaiting || !isMyTurn || cell !== "" || isOver;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => onMove(i)}
                aria-label={`Cell ${i + 1}${cell ? `, ${cell}` : ""}`}
                className={cn(
                  "flex aspect-square items-center justify-center rounded-2xl border shadow-soft transition-all duration-150",
                  inWinningLine
                    ? "border-primary bg-primary/20 shadow-glow"
                    : "border-border bg-card hover:border-primary/60 hover:shadow-lift",
                  !disabled &&
                    "cursor-pointer hover:-translate-y-0.5 active:scale-95",
                  disabled && !isWaiting && "cursor-default",
                )}
              >
                {cell === "X" && <XMark className="h-3/5 w-3/5" />}
                {cell === "O" && <OMark className="h-3/5 w-3/5" />}
              </button>
            );
          })}
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        {myMarker === "X" ? "You're X — you go first." : "You're O."}
        {" "}First to three in a row wins.
      </p>
    </>
  );
}
