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
import {
  useSinglePlayerTicTacToe,
  useSinglePlayerRps,
  useSinglePlayerRedBlack,
  useSinglePlayerPong,
} from "@/lib/ai/useSinglePlayer";
import { isSfxMuted, setSfxMuted } from "@/lib/celebration";
import { cn } from "@/lib/utils";
import type { RpsChoice, RedBlackChoice, PongPower } from "@/lib/gameLogic";
import { PONG_POWERS } from "@/lib/gameLogic";
import { AdSlot } from "@/components/AdSlot";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";

export default function SoloPage() {
  const { gameType = "tic_tac_toe" } = useParams<{ gameType: string }>();
  const entry = getGameEntry(gameType);
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [soundOn, setSoundOn] = useState(() => !isSfxMuted());
  const [angle, setAngle] = useState(0);
  const [power, setPower] = useState<PongPower>(2);

  const supported = supportsSinglePlayer(gameType);
  const ttt = useSinglePlayerTicTacToe(difficulty);
  const rps = useSinglePlayerRps(difficulty);
  const rb = useSinglePlayerRedBlack(difficulty);
  const pong = useSinglePlayerPong(difficulty);

  const title = entry?.name ?? "Solo";

  const celebrationKind = useMemo(() => {
    if (gameType === "tic_tac_toe") {
      if (ttt.state.winner === "X") return "win" as const;
      if (ttt.state.winner === "O") return "loss" as const;
      if (ttt.state.draw) return "draw" as const;
    }
    if (gameType === "rock_paper_scissors" && rps.state.matchWinner) {
      return rps.state.matchWinner === "X" ? ("win" as const) : ("loss" as const);
    }
    if (gameType === "red_or_black" && rb.state.matchWinner) {
      return rb.state.matchWinner === "O" ? ("win" as const) : ("loss" as const);
    }
    if (gameType === "pong" && pong.state.matchWinner) {
      return pong.state.matchWinner === "X" ? ("win" as const) : ("loss" as const);
    }
    return null;
  }, [gameType, ttt.state, rps.state, rb.state, pong.state]);

  const status = useMemo(() => {
    if (gameType === "tic_tac_toe") {
      if (ttt.state.winner === "X") return "You win";
      if (ttt.state.winner === "O") return "AI wins";
      if (ttt.state.draw) return "Draw";
      if (ttt.thinking) return "AI is thinking…";
      return ttt.state.turn === "X" ? "Your turn" : "AI turn";
    }
    if (gameType === "rock_paper_scissors") {
      if (rps.state.matchWinner === "X") return "You take the match";
      if (rps.state.matchWinner === "O") return "AI takes the match";
      if (rps.thinking) return "AI is picking…";
      return `Round ${rps.state.round} · You ${rps.state.scores.X}–${rps.state.scores.O} AI`;
    }
    if (gameType === "red_or_black") {
      if (rb.state.matchWinner === "O") return "You take the match";
      if (rb.state.matchWinner === "X") return "House wins the match";
      return `Round ${rb.state.round} · You ${rb.state.scores.O}–${rb.state.scores.X} House`;
    }
    if (gameType === "pong") {
      if (pong.state.matchWinner === "X") return "You win the match";
      if (pong.state.matchWinner === "O") return "AI wins the match";
      if (pong.thinking) return "AI is swinging…";
      return `You ${pong.state.scores.X}–${pong.state.scores.O} AI · ${pong.state.phase}`;
    }
    return null;
  }, [gameType, ttt, rps, rb, pong]);

  const onReset = () => {
    if (gameType === "tic_tac_toe") ttt.reset();
    if (gameType === "rock_paper_scissors") rps.reset();
    if (gameType === "red_or_black") rb.reset();
    if (gameType === "pong") pong.reset();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {celebrationKind && (
        <CelebrationOverlay
          kind={celebrationKind}
          key={`${gameType}-${celebrationKind}-${status}`}
        />
      )}
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
            setSfxMuted(!next);
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
            <p className="text-sm text-muted-foreground">Solo · vs AI</p>
          </div>
        </div>

        {!supported ? (
          <p className="mt-8 rounded-2xl border border-dashed border-border bg-card/60 p-5 text-sm text-muted-foreground">
            Solo mode isn't available for this game yet. Try Tic Tac Toe, RPS, Red or Black, or Pong.
          </p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap gap-2">
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDifficulty(d);
                    onReset();
                  }}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-bold transition-all",
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

            <div className="mt-6 mb-2 flex items-center justify-between text-sm font-semibold">
              <span>{status}</span>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </button>
            </div>

            {gameType === "tic_tac_toe" && (
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
            )}

            {gameType === "rock_paper_scissors" && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {rps.choices.map((c: RpsChoice) => (
                    <button
                      key={c}
                      type="button"
                      disabled={!!rps.state.matchWinner || rps.thinking}
                      onClick={() => rps.humanPick(c)}
                      className="rounded-2xl border border-border bg-card px-5 py-3 text-sm font-bold capitalize shadow-soft active:scale-[0.98] disabled:opacity-50"
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {rps.state.phase === "resolved" && (
                  <p className="text-sm text-muted-foreground">
                    You played <strong>{rps.state.picks.X}</strong> · AI played{" "}
                    <strong>{rps.state.picks.O}</strong> · {rps.state.winner}
                  </p>
                )}
              </div>
            )}

            {gameType === "red_or_black" && (
              <div className="flex flex-wrap gap-3">
                {(["red", "black"] as RedBlackChoice[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={!!rb.state.matchWinner}
                    onClick={() => rb.humanGuess(c)}
                    className={cn(
                      "rounded-2xl px-8 py-4 text-sm font-black capitalize text-white shadow-soft active:scale-[0.98] disabled:opacity-50",
                      c === "red"
                        ? "bg-gradient-to-b from-rose-400 to-rose-700"
                        : "bg-gradient-to-b from-slate-600 to-slate-900",
                    )}
                  >
                    {c}
                  </button>
                ))}
                {rb.state.phase === "resolved" && (
                  <p className="w-full text-sm text-muted-foreground">
                    You guessed <strong>{rb.state.guess}</strong> · card was{" "}
                    <strong>{rb.state.draw}</strong>
                  </p>
                )}
              </div>
            )}

            {gameType === "pong" && (
              <div className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-soft">
                <label className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Angle {angle}°
                  <input
                    type="range"
                    min={-60}
                    max={60}
                    value={angle}
                    onChange={(e) => setAngle(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                </label>
                <div className="flex gap-2">
                  {PONG_POWERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPower(p)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-bold",
                        power === p
                          ? "bg-emerald-600 text-white"
                          : "border border-border text-muted-foreground",
                      )}
                    >
                      Power {p}
                    </button>
                  ))}
                </div>
                {pong.state.phase === "point_over" && !pong.state.matchWinner ? (
                  <button
                    type="button"
                    onClick={pong.continuePoint}
                    className="w-full rounded-full bg-gradient-to-b from-primary to-primary-deep py-2.5 text-sm font-bold text-white shadow-btn-amber"
                  >
                    Next point
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      !!pong.state.matchWinner ||
                      pong.thinking ||
                      (pong.state.phase === "return" && pong.state.turn !== "X") ||
                      (pong.state.phase === "serve" && pong.state.turn !== "X")
                    }
                    onClick={() => pong.playShot(angle, power)}
                    className="w-full rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {pong.state.phase === "serve" ? "Serve" : "Return"}
                  </button>
                )}
                {pong.state.lastPoint && (
                  <p className="text-xs text-muted-foreground">
                    Last point: {pong.state.lastPoint.good ? "returned" : "missed"} · winner{" "}
                    {pong.state.lastPoint.winner}
                  </p>
                )}
              </div>
            )}

            <div className="mt-10">
              <AdSlot slot="post_match" gameType={gameType} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
