import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
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
import InstallPromptModal from "@/components/InstallPromptModal";
import FloatingVideo from "@/components/FloatingVideo";
import { LiveStatusBar } from "@/components/live/LiveStatusBar";
import { CelebrationOverlay } from "@/components/CelebrationOverlay";
import { AdSlot } from "@/components/AdSlot";
import { useLiveGame } from "@/lib/live";
import {
  joinGame,
  getGameState,
  submitMove,
  playAgain,
  submitFeedback,
  subscribeGame,
  finalizeLiveMatch,
} from "@/lib/games-api";
import { getApiError } from "@/lib/api-error";
import { buildMatchShare, shareMatch } from "@/lib/share";
import { getGameEntry } from "@/lib/gameCatalog";
import type { CelebrationKind } from "@/lib/celebration";
import { useDeviceToken } from "@/hooks/use-device-token";
import { useStreak } from "@/hooks/use-streak";
import {
  ArrowLeft,
  Check,
  Copy,
  Flame,
  Home,
  Loader2,
  MessageCircle,
  RefreshCw,
  Share2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
type PlayerRole = "initiator" | "responder";

interface RpsState {
  round: number;
  phase: "picking" | "resolved";
  picks: { X: RpsChoice | null; O: RpsChoice | null };
  scores: { X: number; O: number };
  winner: "X" | "O" | "draw" | null;
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}
interface RedBlackState {
  round: number;
  phase: "picking" | "resolved";
  guess: RedBlackChoice | null;
  draw: RedBlackChoice | null;
  scores: { X: number; O: number };
  winner: "X" | "O" | null;
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}
interface PongState {
  phase: "serve" | "return" | "point_over" | "match_over";
  turn: Marker;
  serve: { angle: number; power: PongPower } | null;
  scores: { X: number; O: number };
  lastPoint: {
    winner: Marker;
    serve: { angle: number; power: PongPower };
    ret: { angle: number; power: PongPower };
    good: boolean;
  } | null;
  matchWinner: Marker | null;
  rematch?: { slug: string; by: string };
}
interface TwentyQuestionsState {
  phase: "setup" | "asking" | "final" | "match_over";
  secret: string | null;
  pendingQuestion: string | null;
  questions: { text: string; answer: "yes" | "no" }[];
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}
interface HangmanState {
  phase: "setup" | "guessing" | "match_over";
  secret: string | null;
  revealed: string[];
  guessed: string[];
  wrongCount: number;
  maxWrong: number;
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}
interface WordScrambleState {
  phase: "setup" | "solving" | "match_over";
  secret: string | null;
  scrambled: string;
  attemptsLeft: number;
  wrongGuesses: string[];
  winner: Marker | null;
  rematch?: { slug: string; by: string };
}
interface GameSnapshot {
  status: GameStatus;
  gameType: string;
  state: unknown;
  me: { role: PlayerRole; marker: Marker; picked?: boolean } | null;
}

function FullPageMessage({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm rounded-3xl border border-primary/20 bg-card p-8 text-center shadow-lift">
        {icon && (
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-gradient-to-b from-primary/25 to-primary/10 text-primary shadow-chip">
            {icon}
          </div>
        )}
        <h1 className="font-display text-xl font-black tracking-tight">{title}</h1>
        {body && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

export default function GamePage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const deviceToken = useDeviceToken();

  const [joinStatus, setJoinStatus] = useState<"joining" | "joined" | "error">("joining");
  const [joinError, setJoinError] = useState<{ code?: string; message?: string }>({});
  const [me, setMe] = useState<{ role: PlayerRole; marker: Marker } | null>(null);
  const [game, setGame] = useState<GameSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<boolean | null>(null);
  const [creatingRematch, setCreatingRematch] = useState(false);

  const { streak, registerPlay } = useStreak();
  const streakRecordedRef = useRef(false);

  const liveMarker = (game?.me?.marker ?? me?.marker ?? "X") as Marker;
  const liveEnabled =
    joinStatus === "joined" &&
    (game?.status === "in_progress" || game?.status === "completed") &&
    Boolean(game?.me?.marker ?? me?.marker);
  const live = useLiveGame({
    slug,
    deviceToken,
    marker: liveMarker,
    enabled: liveEnabled,
  });

  const lastAimSent = useRef(0);
  const handleLiveAim = useCallback(
    (angle: number) => {
      if (!live.channelOpen) return;
      const now = performance.now();
      if (now - lastAimSent.current < 50) return;
      lastAimSent.current = now;
      live.sendInput(Math.max(-1, Math.min(1, angle / 60)));
    },
    [live.channelOpen, live.sendInput],
  );

  const [prevSlug, setPrevSlug] = useState(slug);
  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setJoinStatus("joining");
    setJoinError({});
    setGame(null);
    setLoadError(null);
    setMe(null);
    setFeedbackSent(null);
    setCreatingRematch(false);
  }

  const refreshGame = useCallback(async () => {
    if (!slug || !deviceToken) return;
    try {
      const data = await getGameState({ slug, deviceToken });
      setGame(data as GameSnapshot);
      setLoadError(null);
    } catch (err) {
      setLoadError(getApiError(err).message ?? "Couldn't load this game.");
    }
  }, [slug, deviceToken]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await joinGame({ slug, deviceToken });
        if (cancelled) return;
        setMe(res.me);
        setJoinStatus("joined");
      } catch (err) {
        if (cancelled) return;
        setJoinError(getApiError(err));
        setJoinStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, deviceToken]);

  useEffect(() => {
    if (joinStatus !== "joined") return;
    void refreshGame();
    return subscribeGame(slug, () => {
      void refreshGame();
    });
  }, [joinStatus, slug, refreshGame]);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play/${slug}` : "";

  const gameType = game?.gameType ?? "tic_tac_toe";
  const isRps = gameType === "rock_paper_scissors";
  const isRedBlack = gameType === "red_or_black";
  const isPong = gameType === "pong";
  const isTwentyQuestions = gameType === "twenty_questions";
  const isHangman = gameType === "hangman";
  const isWordScramble = gameType === "word_scramble";
  const matchGame = isRps || isRedBlack || isPong;
  const status: GameStatus | null = game?.status ?? null;
  const state = (game?.state as TicTacToeState) ?? null;
  const rpsState = (game?.state as RpsState) ?? null;
  const rbState = (game?.state as RedBlackState) ?? null;
  const pongState = (game?.state as PongState) ?? null;
  const tqState = (game?.state as TwentyQuestionsState) ?? null;
  const hangmanState = (game?.state as HangmanState) ?? null;
  const scrambleState = (game?.state as WordScrambleState) ?? null;
  const myMarker: Marker | null = game?.me?.marker ?? me?.marker ?? null;
  const matchWinner: Marker | null = matchGame
    ? isRps
      ? (rpsState?.matchWinner ?? null)
      : isRedBlack
        ? (rbState?.matchWinner ?? null)
        : (pongState?.matchWinner ?? null)
    : null;

  const isOver = matchGame
    ? matchWinner !== null
    : isTwentyQuestions
      ? tqState !== null && tqState.winner !== null
      : isHangman
        ? hangmanState !== null && hangmanState.winner !== null
        : isWordScramble
          ? scrambleState !== null && scrambleState.winner !== null
          : state !== null && (state.winner !== null || state.draw);

  const celebrationKind: CelebrationKind | null = (() => {
    if (!isOver) return null;
    if (matchGame) {
      if (!matchWinner || !myMarker) return "draw";
      return matchWinner === myMarker ? "win" : "loss";
    }
    if (isTwentyQuestions || isHangman || isWordScramble) {
      const w = isTwentyQuestions
        ? tqState?.winner
        : isHangman
          ? hangmanState?.winner
          : scrambleState?.winner;
      if (!w || !myMarker) return "draw";
      return w === myMarker ? "win" : "loss";
    }
    if (state?.draw) return "draw";
    if (state?.winner && myMarker) return state.winner === myMarker ? "win" : "loss";
    return null;
  })();

  const handleShareResult = async () => {
    const entry = getGameEntry(gameType);
    const result =
      celebrationKind === "win"
        ? "won"
        : celebrationKind === "loss"
          ? "lost"
          : celebrationKind === "draw"
            ? "drew"
            : "playing";
    const payload = buildMatchShare({
      gameName: entry?.name ?? "Recess",
      result,
      roomUrl: shareUrl,
      scoreLine: matchGame
        ? isRps && rpsState
          ? `${rpsState.scores.X}–${rpsState.scores.O}`
          : isPong && pongState
            ? `${pongState.scores.X}–${pongState.scores.O}`
            : isRedBlack && rbState
              ? `${rbState.scores.X}–${rbState.scores.O}`
              : undefined
        : undefined,
    });
    const outcome = await shareMatch(payload);
    if (outcome === "shared") toast.success("Shared");
    else if (outcome === "copied") toast.success("Result copied");
    else toast.message("Share cancelled");
  };

  useEffect(() => {
    if (!isOver || status !== "completed") return;
    if (streakRecordedRef.current) return;
    streakRecordedRef.current = true;
    registerPlay();
  }, [isOver, status, registerPlay]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const handleCell = async (cell: number) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, cell });
      await refreshGame();
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
      return false;
    }
  };

  const handlePick = async (pick: string) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, pick });
      await refreshGame();
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Pick failed");
      return false;
    }
  };

  const handlePong = async (angle: number, power: PongPower) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, angle, power });
      await refreshGame();
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Shot failed");
      return false;
    }
  };

  const handleTq = async (move: TwentyQuestionsMove) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, ...move });
      await refreshGame();
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
      return false;
    }
  };

  const handleHangman = async (move: HangmanMove) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, ...move });
      await refreshGame();
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
      return false;
    }
  };

  const handleScramble = async (move: WordScrambleMove) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, ...move });
      await refreshGame();
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
      return false;
    }
  };

  const handlePlayAgain = async () => {
    setCreatingRematch(true);
    try {
      const res = await playAgain({ slug, deviceToken });
      navigate(`/play/${res.slug}`);
    } catch (err) {
      toast.error(getApiError(err).message ?? "Rematch failed");
    } finally {
      setCreatingRematch(false);
    }
  };

  const handleFeedback = async (wouldPlayAgain: boolean) => {
    try {
      await submitFeedback({ slug, deviceToken, wouldPlayAgain });
      setFeedbackSent(wouldPlayAgain);
    } catch {
      toast.error("Couldn't save feedback");
    }
  };

  if (joinStatus === "joining") {
    return (
      <FullPageMessage icon={<Loader2 className="size-6 animate-spin" />} title="Joining your game…" />
    );
  }
  if (joinStatus === "error") {
    return (
      <FullPageMessage
        icon={<MessageCircle className="size-6" />}
        title="Can't get into this game"
        body={joinError.message}
        action={
          <Button onClick={() => navigate("/")} className="rounded-full px-6">
            <Home className="size-4" /> Back to Recess
          </Button>
        }
      />
    );
  }
  if (loadError) {
    return (
      <FullPageMessage
        icon={<MessageCircle className="size-6" />}
        title="Can't get into this game"
        body={loadError}
        action={
          <Button onClick={() => navigate("/")} className="rounded-full px-6">
            <Home className="size-4" /> Back to Recess
          </Button>
        }
      />
    );
  }
  if (!game || !status) {
    return <FullPageMessage icon={<Loader2 className="size-6 animate-spin" />} title="Loading…" />;
  }
  if (status === "abandoned") {
    return (
      <FullPageMessage
        icon={<MessageCircle className="size-6" />}
        title="This game went quiet"
        body="It sat untouched for 48 hours, so Recess closed it."
        action={
          <Button onClick={() => navigate("/")} className="rounded-full px-6">
            <Home className="size-4" /> Back to Recess
          </Button>
        }
      />
    );
  }

  const isWaiting = status === "waiting";
  const rematch =
    (state as { rematch?: { slug: string; by: string } } | null)?.rematch ??
    rpsState?.rematch ??
    rbState?.rematch ??
    pongState?.rematch ??
    tqState?.rematch ??
    hangmanState?.rematch ??
    scrambleState?.rematch ??
    null;

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <CelebrationOverlay kind={isOver ? celebrationKind : null} />
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-chip"
          aria-label="Back to Recess"
        >
          <ArrowLeft className="size-4" />
        </button>
        <Wordmark size="sm" />
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-md px-5 pb-16">
        {isWaiting && (
          <div className="relative mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-card p-5 shadow-soft">
            <h2 className="text-base font-black tracking-tight">Send this link to your friend</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Paste it in WhatsApp or any chat. It opens straight into the game.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5 shadow-chip">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
                {shareUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-primary to-primary-deep text-white shadow-btn-amber"
                aria-label="Copy link"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`You've been challenged on Recess! ${shareUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white"
            >
              <MessageCircle className="size-4" /> Share on WhatsApp
            </a>
          </div>
        )}

        {!isWaiting && myMarker && (
          <div className="mt-4">
            <LiveStatusBar
              connectionState={live.connectionState}
              channelOpen={live.channelOpen}
              onGoLive={live.start}
              onHangup={() => {
                void (async () => {
                  try {
                    await finalizeLiveMatch({
                      slug,
                      deviceToken,
                      reason: "disconnect",
                    });
                  } catch {
                    /* ignore */
                  }
                  await live.hangup();
                })();
              }}
            />
          </div>
        )}

        {moveError && (
          <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-xs font-semibold text-destructive">
            {moveError}
          </p>
        )}

        <div className="mt-6">
          {isRps ? (
            <RpsPlay
              state={rpsState!}
              status={status}
              myMarker={myMarker!}
              picked={game.me?.picked}
              onPick={handlePick}
            />
          ) : isRedBlack ? (
            <RedBlackPlay
              state={rbState!}
              status={status}
              myMarker={myMarker!}
              onGuess={(g) => handlePick(g)}
            />
          ) : isPong ? (
            <PongPlay
              state={pongState!}
              status={status}
              myMarker={myMarker!}
              onShot={handlePong}
              liveConnected={live.channelOpen}
              remoteAim={live.remoteAxis != null ? live.remoteAxis * 60 : null}
              onAimChange={live.channelOpen ? handleLiveAim : undefined}
            />
          ) : isTwentyQuestions ? (
            <TwentyQuestionsPlay
              state={tqState!}
              status={status}
              myMarker={myMarker!}
              onSubmit={handleTq}
            />
          ) : isHangman ? (
            <HangmanPlay
              state={hangmanState!}
              status={status}
              myMarker={myMarker!}
              onSubmit={handleHangman}
            />
          ) : isWordScramble ? (
            <WordScramblePlay
              state={scrambleState!}
              status={status}
              myMarker={myMarker!}
              onSubmit={handleScramble}
            />
          ) : (
            <TicTacToePlay
              state={state!}
              status={status}
              myMarker={myMarker!}
              onMove={handleCell}
            />
          )}
        </div>

        {isOver && (
          <div className="mt-8 text-center">
            {streak > 0 && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-chip">
                <Flame className="size-4 text-primary" />
                <p className="text-sm font-bold">
                  {streak === 1 ? "Day 1 — every game counts." : `${streak}-day streak`}
                </p>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full rounded-full py-6 text-base font-bold"
                onClick={() => void handleShareResult()}
              >
                <Share2 className="size-4" /> Share result
              </Button>
              {rematch && rematch.by !== deviceToken ? (
                <Button
                  className="w-full rounded-full py-6 text-base font-bold"
                  onClick={() => navigate(`/play/${rematch.slug}`)}
                >
                  <RefreshCw className="size-4" /> Join rematch
                </Button>
              ) : (
                <Button
                  className="w-full rounded-full py-6 text-base font-bold"
                  onClick={handlePlayAgain}
                  disabled={creatingRematch}
                >
                  {creatingRematch ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                  Play again
                </Button>
              )}
            </div>
            <div className="mt-6">
              <AdSlot slot="post_match" gameType={gameType} />
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-bold">Would you play again?</p>
              {feedbackSent === null ? (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFeedback(true)}
                    className="flex h-10 w-16 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-bold text-white"
                  >
                    <Check className="size-4" /> Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(false)}
                    className="flex h-10 w-16 items-center justify-center rounded-full border border-border text-sm font-bold text-muted-foreground"
                  >
                    No
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Thanks for the feedback.</p>
              )}
            </div>
          </div>
        )}
      </main>
      <InstallPromptModal />
      <FloatingVideo />
    </div>
  );
}
