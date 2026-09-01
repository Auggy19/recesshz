import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Volume2, VolumeX } from "lucide-react";
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
  const [searchParams] = useSearchParams();
  const entry = getGameEntry(gameType);
  const initialDifficulty = ((): Difficulty => {
    const q = searchParams.get("difficulty");
    if (q === "beginner" || q === "intermediate" || q === "expert") return q;
    return "intermediate";
  })();
  const [difficulty, setDifficulty] = useState<Difficulty>(initialDifficulty);
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

            {gameType === "pong" &&
              (() => {
                const clamp = (v: number, lo: number, hi: number) =>
                  Math.max(lo, Math.min(hi, v));
                const posX = (a: number) => clamp(50 + a * 0.55, 8, 92);
                const myTurn =
                  !pong.state.matchWinner &&
                  !pong.thinking &&
                  ((pong.state.phase === "serve" && pong.state.turn === "X") ||
                    (pong.state.phase === "return" && pong.state.turn === "X"));
                const angleMin = pong.state.phase === "return" ? -45 : -60;
                const angleMax = pong.state.phase === "return" ? 45 : 60;
                const serve = pong.state.serve;
                const last = pong.state.lastPoint;
                let ballX = 50;
                let ballY = pong.state.turn === "X" ? 18 : 82;
                if (pong.state.phase === "return" && serve) {
                  ballX = posX(serve.angle);
                  ballY = pong.state.turn === "X" ? 18 : 82;
                } else if (
                  (pong.state.phase === "point_over" ||
                    pong.state.phase === "match_over") &&
                  last
                ) {
                  ballX = last.good
                    ? posX(-last.ret.angle)
                    : posX(last.serve.angle);
                  ballY = 50;
                }
                const myPaddleX = myTurn ? posX(angle) : 50;
                const aiPaddleX =
                  pong.state.phase === "return" && serve && pong.state.turn === "X"
                    ? posX(serve.angle)
                    : 50;
                const nudge = (dir: -1 | 1) => {
                  if (!myTurn) return;
                  const stepped = Math.round((angle + dir * 5) / 5) * 5;
                  setAngle(clamp(stepped, angleMin, angleMax));
                };
                return (
                  <div className="space-y-4">
                    <div
                      className="relative mx-auto w-full max-w-[min(100%,280px)] overflow-hidden rounded-3xl border-2 border-[#1A1A1A] bg-[#FFF9E5] shadow-lift dark:bg-amber-950/40"
                      style={{ aspectRatio: "3 / 4" }}
                      role="img"
                      aria-label="Pong court"
                    >
                      <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 border-t border-dashed border-[#1A1A1A]/25" />
                      <div
                        className="absolute top-[5%] h-[10px] w-[28%] max-w-[72px] -translate-x-1/2 rounded-full bg-[#1A1A1A] shadow-md transition-[left] duration-150"
                        style={{ left: `${aiPaddleX}%` }}
                      />
                      <div
                        className="absolute bottom-[5%] h-[10px] w-[28%] max-w-[72px] -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-primary-deep shadow-[0_2px_10px_rgba(245,166,35,0.45)] transition-[left] duration-75"
                        style={{ left: `${myPaddleX}%` }}
                      />
                      <div
                        className="absolute size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1A1A1A] bg-[#F5A623] shadow-[0_2px_12px_rgba(245,166,35,0.55)] sm:size-[16px]"
                        style={{
                          left: `${ballX}%`,
                          top: `${ballY}%`,
                          transition: "left 400ms ease-out, top 400ms ease-out",
                        }}
                      />
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                      <p className="text-center text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Aim {angle > 0 ? "+" : ""}
                        {angle}°
                      </p>

                      <div className="mt-3 flex items-center gap-3">
                        <button
                          type="button"
                          aria-label="Aim left"
                          disabled={!myTurn}
                          onClick={() => nudge(-1)}
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-background text-foreground shadow-soft active:scale-95 active:border-primary disabled:opacity-40 sm:h-12 sm:w-12"
                        >
                          <ChevronLeft className="size-7 sm:size-6" strokeWidth={2.5} />
                        </button>
                        <div className="relative h-3 flex-1 rounded-full bg-muted">
                          <div
                            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#1A1A1A] bg-primary shadow-md transition-[left] duration-75"
                            style={{
                              left: `${((angle - angleMin) / (angleMax - angleMin || 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          aria-label="Aim right"
                          disabled={!myTurn}
                          onClick={() => nudge(1)}
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-border bg-background text-foreground shadow-soft active:scale-95 active:border-primary disabled:opacity-40 sm:h-12 sm:w-12"
                        >
                          <ChevronRight className="size-7 sm:size-6" strokeWidth={2.5} />
                        </button>
                      </div>
                      <div className="mt-1 flex justify-between px-1 text-[10px] font-semibold text-muted-foreground">
                        <span>Left</span>
                        <span>Right</span>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {PONG_POWERS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPower(p)}
                            className={cn(
                              "flex-1 rounded-full px-3 py-2 text-xs font-bold transition-all",
                              power === p
                                ? "bg-emerald-600 text-white shadow-soft"
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
                          className="mt-3.5 w-full rounded-full bg-gradient-to-b from-primary to-primary-deep py-3 text-sm font-bold text-white shadow-btn-amber"
                        >
                          Next point
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!myTurn}
                          onClick={() => pong.playShot(angle, power)}
                          className="mt-3.5 w-full rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {pong.thinking
                            ? "AI is swinging…"
                            : pong.state.phase === "serve"
                              ? "Serve"
                              : "Return"}
                        </button>
                      )}

                      {last && (
                        <p className="mt-2 text-center text-xs text-muted-foreground">
                          Last: {last.good ? "returned" : "missed"} ·{" "}
                          {last.winner === "X" ? "You" : "AI"} scored
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

            <div className="mt-10">
              <AdSlot slot="post_match" gameType={gameType} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
