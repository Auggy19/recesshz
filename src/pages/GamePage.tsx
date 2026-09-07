import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  GamePlayRouter,
  isGameOver as isPlayOver,
  celebrationFor,
} from "@/components/games/GamePlayRouter";
import InstallPromptModal from "@/components/InstallPromptModal";
import FloatingVideo from "@/components/FloatingVideo";
import { LiveStatusBar } from "@/components/live/LiveStatusBar";
import { RealtimeDebugHud } from "@/components/RealtimeDebugHud";
import type { RealtimeStatus } from "@/lib/games-api";
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
import type { Marker } from "@/components/games/TicTacToePlay";
import type { PongPower } from "@/components/games/PongPlay";
import type { TwentyQuestionsMove } from "@/components/games/TwentyQuestionsPlay";
import type { HangmanMove } from "@/components/games/HangmanPlay";
import type { WordScrambleMove } from "@/components/games/WordScramblePlay";

type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
type PlayerRole = "initiator" | "responder";

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
  const [rtStatus, setRtStatus] = useState<RealtimeStatus>("idle");
  const [rtLastEventAt, setRtLastEventAt] = useState<number | null>(null);
  const [rtLastEventType, setRtLastEventType] = useState<string | null>(null);
  const [rtEventCount, setRtEventCount] = useState(0);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<boolean | null>(null);
  const [creatingRematch, setCreatingRematch] = useState(false);
  const [celebrationShow, setCelebrationShow] = useState<CelebrationKind | null>(null);
  const celebrationFiredRef = useRef(false);

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
    celebrationFiredRef.current = false;
    setCelebrationShow(null);
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
    setRtStatus("connecting");
    setRtEventCount(0);
    setRtLastEventAt(null);
    setRtLastEventType(null);
    return subscribeGame(
      slug,
      () => {
        void refreshGame();
      },
      {
        onStatus: (status) => setRtStatus(status),
        onEvent: ({ eventType, at }) => {
          setRtLastEventType(eventType);
          setRtLastEventAt(at);
          setRtEventCount((n) => n + 1);
        },
      },
    );
  }, [joinStatus, slug, refreshGame]);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play/${slug}` : "";

  const gameType = game?.gameType ?? "tic_tac_toe";
  const myMarker: Marker | null = game?.me?.marker ?? me?.marker ?? null;
  const status: GameStatus | null = game?.status ?? null;
  const isOver = isPlayOver(gameType, game?.state);
  const celebrationKind: CelebrationKind | null = isOver
    ? celebrationFor(gameType, game?.state, myMarker)
    : null;

  useEffect(() => {
    if (!isOver || !celebrationKind) return;
    if (celebrationFiredRef.current) return;
    celebrationFiredRef.current = true;
    setCelebrationShow(celebrationKind);
  }, [isOver, celebrationKind]);

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

  const handleShareInvite = async () => {
    const entry = getGameEntry(gameType);
    const payload = buildMatchShare({
      gameName: entry?.name ?? "Recess",
      result: "playing",
      roomUrl: shareUrl,
    });
    const outcome = await shareMatch(payload);
    if (outcome === "shared") toast.success("Challenge shared");
    else if (outcome === "copied") toast.success("Invite copied");
    else toast.message("Share cancelled");
  };

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
    });
    const outcome = await shareMatch(payload);
    if (outcome === "shared") toast.success("Shared");
    else if (outcome === "copied") toast.success("Result copied");
    else toast.message("Share cancelled");
  };

  const handleCell = async (cell: number) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, cell });
      await refreshGame();
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
    }
  };

  const handlePick = async (pick: string) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, pick });
      await refreshGame();
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Pick failed");
    }
  };

  const handlePong = async (angle: number, power: PongPower) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, angle, power });
      await refreshGame();
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Shot failed");
    }
  };

  const handleTq = async (move: TwentyQuestionsMove) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, ...move });
      await refreshGame();
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
    }
  };

  const handleHangman = async (move: HangmanMove) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, ...move });
      await refreshGame();
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
    }
  };

  const handleScramble = async (move: WordScrambleMove) => {
    setMoveError(null);
    try {
      await submitMove({ slug, deviceToken, ...move });
      await refreshGame();
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
    }
  };

  const handleTod = async (
    move: { action: "choose"; kind: "truth" | "dare" } | { action: "done" } | { action: "skip" },
  ) => {
    setMoveError(null);
    try {
      await submitMove({
        slug,
        deviceToken,
        todAction: move.action,
        kind: move.action === "choose" ? move.kind : undefined,
      });
      await refreshGame();
    } catch (err) {
      setMoveError(getApiError(err).message ?? "Move failed");
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
      toast.error("Couldn't send feedback");
    }
  };

  if (joinStatus === "joining") {
    return (
      <FullPageMessage
        icon={<Loader2 className="size-6 animate-spin" />}
        title="Opening room…"
        body="One moment while we seat you at the table."
      />
    );
  }

  if (joinStatus === "error") {
    return (
      <FullPageMessage
        title="Couldn't join"
        body={joinError.message ?? "This room may be full, expired, or locked."}
        action={
          <Button className="rounded-full" onClick={() => navigate("/")}>
            <Home className="size-4" /> Home
          </Button>
        }
      />
    );
  }

  if (!game && loadError) {
    return (
      <FullPageMessage
        title="Couldn't load"
        body={loadError}
        action={
          <Button className="rounded-full" onClick={() => void refreshGame()}>
            <RefreshCw className="size-4" /> Retry
          </Button>
        }
      />
    );
  }

  const entry = getGameEntry(gameType);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Home
        </button>
        <Wordmark size="sm" />
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-2">
        <div className="mb-4 text-center">
          <h1 className="font-display text-xl font-black tracking-tight">
            {entry?.name ?? "Game"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {status === "waiting"
              ? "Waiting for your friend — share the link below."
              : status === "completed"
                ? "Match finished"
                : "Your move when the board says so."}
          </p>
        </div>

        {status === "waiting" && (
          <div className="mb-4 rounded-2xl border border-border bg-card p-4 text-center shadow-soft">
            <p className="text-sm font-semibold">Invite link</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{shareUrl}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="rounded-full" onClick={() => void handleCopyLink()}>
                <Copy className="size-4" /> Copy
              </Button>
              <Button className="rounded-full" onClick={() => void handleShareInvite()}>
                <Share2 className="size-4" /> Share
              </Button>
            </div>
          </div>
        )}

        {game && (
          <div className="space-y-3">
            <LiveStatusBar
              connected={live.channelOpen}
              onForfeit={() => {
                void (async () => {
                  try {
                    await finalizeLiveMatch({
                      slug,
                      deviceToken,
                      reason: "forfeit",
                    });
                  } catch {
                    /* ignore */
                  }
                  live.stop();
                })();
              }}
            />
            <GamePlayRouter
              gameType={gameType}
              status={status ?? "waiting"}
              myMarker={myMarker ?? "X"}
              state={game.state}
              picked={game.me?.picked}
              onCell={(cell) => void handleCell(cell)}
              onPick={(pick) => void handlePick(pick)}
              onPong={(angle, power) => void handlePong(angle, power)}
              onTq={(move) => void handleTq(move)}
              onHangman={(move) => void handleHangman(move)}
              onScramble={(move) => void handleScramble(move)}
              onTod={(move) => void handleTod(move)}
              liveConnected={live.channelOpen}
              remoteAim={live.remoteAim}
              onAimChange={handleLiveAim}
            />
            {moveError && (
              <p className="text-center text-xs text-destructive">{moveError}</p>
            )}
          </div>
        )}

        {isOver && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-5 text-center shadow-soft">
            {streak > 0 && (
              <p className="mb-2 flex items-center justify-center gap-1 text-xs font-bold text-primary">
                <Flame className="size-3.5" /> {streak}-day streak
              </p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="w-full rounded-full py-6 text-base font-bold"
                onClick={() => void handleShareResult()}
              >
                <Share2 className="size-4" /> Share result
              </Button>
              <Button
                className="w-full rounded-full py-6 text-base font-bold"
                disabled={creatingRematch}
                onClick={() => void handlePlayAgain()}
              >
                {creatingRematch ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Play again
              </Button>
            </div>
            <div className="mt-6">
              <AdSlot slot="post_match" gameType={gameType} />
            </div>
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-bold">Would you play again?</p>
              {feedbackSent === null ? (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void handleFeedback(true)}
                  >
                    <Check className="size-4" /> Yes
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => void handleFeedback(false)}
                  >
                    Not really
                  </Button>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Thanks for the note.</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <InstallPromptModal
            renderTrigger={(open) => (
              <button
                type="button"
                onClick={open}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Add Recess to your home screen
              </button>
            )}
          />
        </div>
      </main>

      <CelebrationOverlay
        kind={celebrationShow}
        onDone={() => setCelebrationShow(null)}
      />
      <FloatingVideo />
      <RealtimeDebugHud
        status={rtStatus}
        lastEventAt={rtLastEventAt}
        lastEventType={rtLastEventType}
        eventCount={rtEventCount}
      />
    </div>
  );
}
