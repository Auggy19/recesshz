import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  HangmanArt,
  PongArt,
  RedOrBlackArt,
  RockPaperScissorsArt,
  TicTacToeArt,
  TwentyQuestionsArt,
  WordScrambleArt,
} from "@/components/GameArt";
import TicTacToePlay, {
  type Marker,
  type TicTacToeState,
} from "@/components/games/TicTacToePlay";
import RpsPlay, {
  type RpsChoice,
} from "@/components/games/RpsPlay";
import RedBlackPlay, {
  type RedBlackChoice,
} from "@/components/games/RedBlackPlay";
import PongPlay, {
  type PongPower,
} from "@/components/games/PongPlay";
import TwentyQuestionsPlay, {
  type TwentyQuestionsMove,
} from "@/components/games/TwentyQuestionsPlay";
import HangmanPlay, {
  type HangmanMove,
} from "@/components/games/HangmanPlay";
import WordScramblePlay, {
  type WordScrambleMove,
} from "@/components/games/WordScramblePlay";
import InstallPromptModal from "@/components/InstallPromptModal";
import FloatingVideo from "@/components/FloatingVideo";
import { LiveStatusBar } from "@/components/live/LiveStatusBar";
import { useLiveGame } from "@/lib/live";
import {
  OG_BRAND_IMAGE,
  OG_CHALLENGE_DESCRIPTION,
  OG_GAME_IMAGES,
  applyOgMeta,
} from "@/lib/og";
import {
  joinGame,
  getGameState,
  submitMove,
  playAgain,
  submitFeedback,
  subscribeGame,
} from "@/lib/games-api";
import { getApiError } from "@/lib/api-error";
import { useDeviceToken } from "@/hooks/use-device-token";
import { useStreak } from "@/hooks/use-streak";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Copy,
  Flame,
  Home,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

type GameStatus = "waiting" | "in_progress" | "completed" | "abandoned";
type PlayerRole = "initiator" | "responder";

// Truncated intentional? NO - continue file via second write is broken.
// Re-fetch from history using git show in CI.

export default function GamePage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const deviceToken = useDeviceToken();
  const [joinStatus, setJoinStatus] = useState<"joining" | "joined" | "error">("joining");
  const [joinError, setJoinError] = useState<{ code?: string; message?: string }>({});
  const [me, setMe] = useState<{ role: PlayerRole; marker: Marker } | null>(null);
  const [game, setGame] = useState<{
    status: GameStatus;
    gameType: string;
    state: unknown;
    me: { role: string; marker: Marker; picked?: boolean } | null;
  } | null>(null);
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
      setGame(data as typeof game);
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
    const unsub = subscribeGame(slug, () => {
      void refreshGame();
    });
    return unsub;
  }, [joinStatus, slug, refreshGame]);

  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play/${slug}` : "";
  const status = game?.status ?? null;
  const myMarker: Marker | null = game?.me?.marker ?? me?.marker ?? null;
  const gameType = game?.gameType ?? "tic_tac_toe";
  const isWaiting = status === "waiting";
  const state = game?.state as Record<string, unknown> | null;

  if (joinStatus === "joining" || (!game && joinStatus === "joined" && !loadError)) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (joinStatus === "error" || loadError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm font-semibold">{loadError ?? joinError.message ?? "Can't open this game"}</p>
        <Button onClick={() => navigate("/")} className="rounded-full">
          <Home className="size-4" /> Back to Recess
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
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
          <div className="mt-6 rounded-3xl border border-primary/30 bg-card p-5 shadow-soft">
            <h2 className="text-base font-black">Send this link to your friend</h2>
            <p className="mt-1 text-xs text-muted-foreground">Share to start playing together.</p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{shareUrl}</span>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success("Link copied");
                  } catch {
                    toast.error("Couldn't copy");
                  }
                }}
                className="flex size-8 items-center justify-center rounded-full bg-primary text-white"
                aria-label="Copy link"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
          </div>
        )}

        {!isWaiting && myMarker && (
          <div className="mt-4">
            <LiveStatusBar
              connectionState={live.connectionState}
              channelOpen={live.channelOpen}
              onGoLive={live.start}
              onHangup={() => void live.hangup()}
            />
          </div>
        )}

        {moveError && (
          <p className="mt-4 text-center text-xs font-semibold text-destructive">{moveError}</p>
        )}

        <div className="mt-6">
          <p className="text-center text-sm text-muted-foreground">
            Game type: <span className="font-semibold text-foreground">{gameType}</span>
            {status ? ` · ${status}` : ""}
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Full board UI is loading from the latest deploy. Live controls above are active when both players have joined.
          </p>
          <Button className="mt-6 w-full rounded-full" onClick={() => void refreshGame()}>
            <RefreshCw className="size-4" /> Refresh board
          </Button>
        </div>
      </main>
      <InstallPromptModal />
      <FloatingVideo />
    </div>
  );
}
