import { useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { GameIcon } from "@/components/GameIcon";
import { getGameEntry } from "@/lib/gameCatalog";
import {
  DIFFICULTY_BLURBS,
  DIFFICULTY_LABELS,
  type Difficulty,
} from "@/lib/design-tokens";
import { supportsSinglePlayer } from "@/lib/ai";
import { useSinglePlayerTicTacToe } from "@/lib/ai/useSinglePlayer";
import { getSoundEnabled, setSoundEnabled } from "@/lib/audio/celebration";
import { cn } from "@/lib/utils";

export default function SoloPage() {
  const { gameType = "tic_tac_toe" } = useParams<{ gameType: string }>();
  const entry = getGameEntry(gameType);
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [soundOn, setSoundOn] = useState(() => getSoundEnabled());

  const supported = supportsSinglePlayer(gameType);
  const ttt = useSinglePlayerTicTacToe(difficulty);

  const title = entry?.name ?? "Solo";

  const status = useMemo(() => {
    if (gameType !== "tic_tac_toe") return null;
    if (ttt.state.winner === "X") return "You win";
    if (ttt.state.winner === "O") return "AI wins";
    if (ttt.state.draw) return "Draw";
    if (ttt.thinking) return "AI is thinking…";
    return ttt.state.turn === "X" ? "Your turn" : "AI turn";
  }, [gameType, ttt.state, ttt.thinking]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-3 px-5 py-5">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Recess
        </Link>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold"
          onClick={() => {
            const next = !soundOn;
            setSoundOn(next);
            setSoundEnabled(next);
          }}
        >
          {soundOn ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          {soundOn ? "Sound on" : "Muted"}
        </button>
      </header>

      <main className="mx-auto w-full max-w-lg px-5 pb-16">
        <div className="flex items-center gap-3">
          <GameIcon gameType={gameType} size="md" />
          <div>
            <h1 className="font-display text-2xl font-black tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">Single player · vs AI</p>
          </div>
        </div>

        {!supported ? (
          <p className="mt-8 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Solo mode for this game is on the way. Try Tic Tac Toe, RPS, Red or Black, or Pong.
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {(["beginner", "intermediate", "expert"] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDifficulty(d);
                    ttt.reset();
                  }}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
                    difficulty === d
                      ? "bg-gradient-to-b from-primary to-primary-deep text-white shadow-btn-amber"
                      : "border border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{DIFFICULTY_BLURBS[difficulty]}</p>

            {gameType === "tic_tac_toe" && (
              <div className="mt-8">
                <div className="mb-3 flex items-center justify-between text-sm font-semibold">
                  <span>{status}</span>
                  <button
                    type="button"
                    onClick={ttt.reset}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs"
                  >
                    <RotateCcw className="size-3.5" />
                    Reset
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ttt.state.board.map((cell, i) => {
                    const win = ttt.state.winningLine?.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={!!cell || !!ttt.state.winner || ttt.state.draw || ttt.thinking}
                        onClick={() => ttt.humanMove(i)}
                        className={cn(
                          "aspect-square rounded-2xl border text-3xl font-black transition-colors",
                          win
                            ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "border-border bg-card hover:bg-accent",
                          !cell && !ttt.state.winner && "active:scale-[0.98]",
                        )}
                      >
                        {cell}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {gameType !== "tic_tac_toe" && (
              <p className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
                AI helpers for {title} are ready. Full solo UI for this title ships next — Tic Tac Toe is playable now.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
