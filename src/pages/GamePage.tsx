import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  PongArt,
  RedOrBlackArt,
  RockPaperScissorsArt,
  TicTacToeArt,
  TwentyQuestionsArt,
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
import InstallPromptModal from "@/components/InstallPromptModal";
import FloatingVideo from "@/components/FloatingVideo";
import { api } from "@/convex/_generated/api";
import {
  OG_BRAND_IMAGE,
  OG_CHALLENGE_DESCRIPTION,
  OG_GAME_IMAGES,
  applyOgMeta,
} from "@/lib/og";
import { useDeviceToken } from "@/hooks/use-device-token";
import { useStreak } from "@/hooks/use-streak";
import {
  useMutation,
  useQuery_experimental as useQuery,
} from "convex/react";
import { ConvexError } from "convex/values";
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
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Shared client-side types (mirror the server shapes)
// ---------------------------------------------------------------------------

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

interface ApiError {
  code?: string;
  message?: string;
}

function getApiError(err: unknown): ApiError {
  if (err instanceof ConvexError) {
    const data = err.data as ApiError;
    return { code: data?.code, message: data?.message };
  }
  if (err instanceof Error) return { message: err.message };
  return { message: "Something went wrong. Please try again." };
}

/**
 * Status-aware share title for the game invite template: "[Game] — Your Turn"
 * whenever it's an invite or genuinely your move; win/loss/draw once it's over.
 */
function gameOgTitle(
  status: GameStatus | null,
  gameLabel: string,
  isRps: boolean,
  isRedBlack: boolean,
  isPong: boolean,
  isTwentyQuestions: boolean,
  state: TicTacToeState | null,
  rpsState: RpsState | null,
  rbState: RedBlackState | null,
  pongState: PongState | null,
  tqState: TwentyQuestionsState | null,
  myMarker: Marker | null,
): string {
  if (status === "waiting") return `${gameLabel} — Your Turn`;
  if (status === "abandoned") return "Recess — This game went quiet";
  if (status === "completed") {
    const winner = isRps
      ? (rpsState?.matchWinner ?? null)
      : isRedBlack
        ? (rbState?.matchWinner ?? null)
        : isPong
          ? (pongState?.matchWinner ?? null)
          : isTwentyQuestions
            ? (tqState?.winner ?? null)
            : (state?.winner ?? null);
    if (winner === myMarker) return `${gameLabel} — You Win!`;
    if (winner === null) return `${gameLabel} — It's a Draw`;
    return `${gameLabel} — Your Friend Wins`;
  }
  // in_progress
  if (isPong) {
    return pongState?.turn === myMarker
      ? `${gameLabel} — Your Turn`
      : `${gameLabel} — Waiting on Your Friend`;
  }
  if (isRps) return `${gameLabel} — Your Turn`;
  if (isRedBlack) {
    // Only the guesser (O) ever has a turn in Red or Black.
    return rbState?.phase === "picking" && myMarker === "O"
      ? `${gameLabel} — Your Turn`
      : `${gameLabel} — Waiting on Your Friend`;
  }
  if (isTwentyQuestions) {
    // Setup: X picks the secret. Asking/final: whoever has the floor.
    const tqTurn =
      tqState?.phase === "setup"
        ? myMarker === "X"
        : tqState?.pendingQuestion !== null
          ? myMarker === "X"
          : myMarker === "O";
    return tqTurn
      ? `${gameLabel} — Your Turn`
      : `${gameLabel} — Waiting on Your Friend`;
  }
  return state?.turn === myMarker
    ? `${gameLabel} — Your Turn`
    : `${gameLabel} — Waiting on Your Friend`;
}

function gameOgDescription(status: GameStatus | null): string {
  if (status === "abandoned") {
    return "This game went quiet after 48 hours. Start a fresh one — silence is safe here.";
  }
  return OG_CHALLENGE_DESCRIPTION;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

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
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
        {icon && (
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            {icon}
          </div>
        )}
        <h1 className="text-xl font-black tracking-tight">{title}</h1>
        {body && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {body}
          </p>
        )}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The game page
// ---------------------------------------------------------------------------

export default function GamePage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const deviceToken = useDeviceToken();

  const joinGame = useMutation(api.games.joinGame);
  const submitMove = useMutation(api.games.submitMove);
  const playAgain = useMutation(api.games.playAgain);
  const submitFeedback = useMutation(api.games.submitFeedback);

  const [joinStatus, setJoinStatus] = useState<"joining" | "joined" | "error">(
    "joining",
  );
  const [joinError, setJoinError] = useState<ApiError>({});
  const [me, setMe] = useState<{ role: PlayerRole; marker: Marker } | null>(
    null,
  );
  const [moveError, setMoveError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<boolean | null>(null);
  const [creatingRematch, setCreatingRematch] = useState(false);

  // Daily streak — recorded once per completed game (idempotent per day).
  const { streak, registerPlay } = useStreak();
  const streakRecordedRef = useRef(false);

  // Reset join state when the slug changes (e.g. following a rematch link) —
  // a render-time adjustment, the React-recommended pattern for prop-derived
  // state, so the effect itself never calls setState synchronously.
  const [prevSlug, setPrevSlug] = useState(slug);
  if (prevSlug !== slug) {
    setPrevSlug(slug);
    setJoinStatus("joining");
    setJoinError({});
  }

  // Join (or re-join) the game with this device's token. Idempotent, so
  // re-opening the link or a retry is safe. New devices on a full game are
  // rejected server-side.
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
  }, [slug, deviceToken, joinGame]);

  // Reactive game state — updates the instant the opponent moves.
  const query = useQuery({
    query: api.games.getGameState,
    args: joinStatus === "joined" ? { slug, deviceToken } : "skip",
  });

  // Fresh link for sharing (also used for the OG preview).
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/play/${slug}` : "";

  const game = query.status === "success" ? query.data : null;
  const gameType = game?.gameType ?? "tic_tac_toe";
  const isRps = gameType === "rock_paper_scissors";
  const isRedBlack = gameType === "red_or_black";
  const isPong = gameType === "pong";
  const isTwentyQuestions = gameType === "twenty_questions";
  // RPS, Red or Black, and Pong share the same match shape (rounds + scores).
  const matchGame = isRps || isRedBlack || isPong;
  const status: GameStatus | null = game?.status ?? null;
  const state = (game?.state as TicTacToeState) ?? null;
  const rpsState = (game?.state as RpsState) ?? null;
  const rbState = (game?.state as RedBlackState) ?? null;
  const pongState = (game?.state as PongState) ?? null;
  const tqState = (game?.state as TwentyQuestionsState) ?? null;
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
      : state !== null && (state.winner !== null || state.draw);

  const gameLabel = isRps
    ? "Rock Paper Scissors"
    : isRedBlack
      ? "Red or Black"
      : isPong
        ? "Pong"
        : isTwentyQuestions
          ? "Twenty Questions"
          : "Tic Tac Toe";

  // Record the streak exactly once when a game completes — the ref guards
  // against the reactive query re-delivering the same terminal state, while
  // registerPlay() itself is idempotent within a local day.
  useEffect(() => {
    if (!isOver || status !== "completed") {
      streakRecordedRef.current = false;
      return;
    }
    if (streakRecordedRef.current) return;
    streakRecordedRef.current = true;
    registerPlay();
  }, [isOver, status, registerPlay]);

  // Keep the tab title + OG tags fresh for link previews (WhatsApp, Instagram,
  // browsers re-sharing the link, etc.). Template 1 (the game invite card):
  // status-aware title, the shared challenge description, and this game's
  // board thumbnail. Crawlers that don't run JS get the static defaults from
  // index.html (Template 2 on the root, or the head script's swap).
  useEffect(() => {
    const title = gameOgTitle(
      status,
      gameLabel,
      isRps,
      isRedBlack,
      isPong,
      isTwentyQuestions,
      state,
      rpsState,
      rbState,
      pongState,
      tqState,
      myMarker,
    );
    applyOgMeta(
      {
        title,
        description: gameOgDescription(status),
        image: OG_GAME_IMAGES[gameType] ?? OG_BRAND_IMAGE,
        imageAlt: `A game of ${gameLabel} waiting for you.`,
      },
      shareUrl,
    );
  }, [status, isRps, isRedBlack, isPong, isTwentyQuestions, state, rpsState, rbState, pongState, tqState, myMarker, gameLabel, gameType, shareUrl]);

  // Clear transient move errors after a moment.
  useEffect(() => {
    if (!moveError) return;
    const t = setTimeout(() => setMoveError(null), 3000);
    return () => clearTimeout(t);
  }, [moveError]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleMove = async (cell: number) => {
    if (!state || isOver) return;
    try {
      await submitMove({ slug, deviceToken, cell });
    } catch (err) {
      setMoveError(getApiError(err).message ?? "That move didn't go through.");
    }
  };

  const handlePick = async (pick: RpsChoice): Promise<boolean> => {
    try {
      await submitMove({ slug, deviceToken, pick });
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "That pick didn't go through.");
      return false;
    }
  };

  const handleGuess = async (guess: RedBlackChoice): Promise<boolean> => {
    try {
      await submitMove({ slug, deviceToken, pick: guess });
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "That guess didn't go through.");
      return false;
    }
  };

  const handleShot = async (angle: number, power: PongPower): Promise<boolean> => {
    try {
      await submitMove({ slug, deviceToken, angle, power });
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "That shot didn't go through.");
      return false;
    }
  };

  const handleTqMove = async (move: TwentyQuestionsMove): Promise<boolean> => {
    try {
      await submitMove({ slug, deviceToken, ...move });
      return true;
    } catch (err) {
      setMoveError(getApiError(err).message ?? "That move didn't go through.");
      return false;
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied — send it in any chat!");
    } catch {
      toast.error("Couldn't copy — long-press the link instead.");
    }
  };

  const handlePlayAgain = async () => {
    setCreatingRematch(true);
    try {
      const res = await playAgain({ slug, deviceToken });
      navigate(`/play/${res.slug}`);
    } catch (err) {
      toast.error(getApiError(err).message ?? "Couldn't start a rematch.");
      setCreatingRematch(false);
    }
  };

  const handleFeedback = async (wouldPlayAgain: boolean) => {
    if (feedbackSent !== null) return;
    setFeedbackSent(wouldPlayAgain);
    try {
      await submitFeedback({ slug, deviceToken, wouldPlayAgain });
    } catch {
      toast.error("Couldn't save your answer — no hard feelings.");
    }
  };

  // -------------------------------------------------------------------------
  // Screens
  // -------------------------------------------------------------------------

  if (joinStatus === "joining") {
    return (
      <FullPageMessage
        icon={<Loader2 className="size-6 animate-spin" />}
        title="Joining your game…"
      />
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
            <Home className="size-4" />
            Back to Recess
          </Button>
        }
      />
    );
  }

  if (query.status === "error") {
    return (
      <FullPageMessage
        icon={<MessageCircle className="size-6" />}
        title="Can't get into this game"
        body={getApiError(query.error).message}
        action={
          <Button onClick={() => navigate("/")} className="rounded-full px-6">
            <Home className="size-4" />
            Back to Recess
          </Button>
        }
      />
    );
  }

  if (!game || !state || !status) {
    return (
      <FullPageMessage
        icon={<Loader2 className="size-6 animate-spin" />}
        title="Loading…"
      />
    );
  }

  // -------------------------------------------------------------------------
  // Abandoned / expired
  // -------------------------------------------------------------------------

  if (status === "abandoned") {
    return (
      <FullPageMessage
        icon={<MessageCircle className="size-6" />}
        title="This game went quiet"
        body="It sat untouched for 48 hours, so Recess closed it. Start a fresh one whenever you're ready."
        action={
          <Button onClick={() => navigate("/")} className="rounded-full px-6">
            <Home className="size-4" />
            Back to Recess
          </Button>
        }
      />
    );
  }

  // -------------------------------------------------------------------------
  // Waiting room (initiator sees the share card)
  // -------------------------------------------------------------------------

  const isWaiting = status === "waiting";

  const myScore = matchGame
    ? isRps
      ? rpsState!.scores[myMarker!]
      : isRedBlack
        ? rbState!.scores[myMarker!]
        : pongState!.scores[myMarker!]
    : 0;
  const oppScore = matchGame
    ? isRps
      ? rpsState!.scores[myMarker === "X" ? "O" : "X"]
      : isRedBlack
        ? rbState!.scores[myMarker === "X" ? "O" : "X"]
        : pongState!.scores[myMarker === "X" ? "O" : "X"]
    : 0;

  const winner: Marker | null = matchGame
    ? matchWinner
    : isTwentyQuestions
      ? (tqState?.winner ?? null)
      : (state?.winner ?? null);
  const draw = !matchGame && !isTwentyQuestions && state !== null && state.draw;

  const resultTitle = matchGame
    ? matchWinner === myMarker
      ? "You win the match!"
      : "Your friend wins the match"
    : winner
      ? winner === myMarker
        ? "You win!"
        : "Your friend wins"
      : "It's a draw";

  const resultSubtitle = matchGame
    ? `Final score — you ${myScore} · friend ${oppScore}. ${
        matchWinner === myMarker
          ? "Silence never felt so good."
          : "Rematch? The score is right there."
      }`
    : isTwentyQuestions
      ? winner === myMarker
        ? "Silence never felt so good."
        : "The secret is out — rematch?"
      : draw
        ? "A perfect standoff."
        : state.winner === myMarker
          ? "Silence never felt so good."
          : "Rematch? The board is waiting.";

  // If the opponent started a rematch, offer to follow them; otherwise the
  // usual Play Again button (which also covers rematches I started myself).
  const rematch = matchGame
    ? isRps
      ? rpsState?.rematch
      : isRedBlack
        ? rbState?.rematch
        : pongState?.rematch
    : isTwentyQuestions
      ? (tqState?.rematch ?? null)
      : (state.rematch ?? null);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 py-5">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Back to Recess"
        >
          <ArrowLeft className="size-4" />
        </button>
        <Wordmark size="sm" />
        <ThemeToggle />
      </header>

      <main className="mx-auto w-full max-w-md px-5 pb-16">
        {/* Share card */}
        {isWaiting && (
          <div className="mt-6 rounded-3xl border-2 border-dashed border-primary/50 bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="hidden shrink-0 rounded-xl border border-border bg-white p-2 sm:block">
                {isRps ? (
                  <RockPaperScissorsArt className="w-16" />
                ) : isRedBlack ? (
                  <RedOrBlackArt className="w-16" />
                ) : isPong ? (
                  <PongArt className="w-16" />
                ) : isTwentyQuestions ? (
                  <TwentyQuestionsArt className="w-16" />
                ) : (
                  <TicTacToeArt className="w-16" />
                )}
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight">
                  Send this link to your friend
                </h2>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {isRps
                    ? "You're X. Best of three — make your pick when they join."
                    : isRedBlack
                      ? "You're the host. Your friend picks red or black — you watch the reveal."
                      : isPong
                        ? "You're X and serve first — first to 7 points wins."
                        : isTwentyQuestions
                          ? "You're the answerer. Pick a secret when they join — they get 20 questions to guess it."
                          : "You're X and play first. Your board waits."}
                </p>
              </div>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Paste it in WhatsApp or any chat. It opens straight into the game.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2.5">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
                {shareUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-transform hover:scale-105"
                aria-label="Copy link"
              >
                <Copy className="size-3.5" />
              </button>
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                `You've been challenged to a game of Recess! Tap to play: ${shareUrl}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="size-4" />
              Share on WhatsApp
            </a>
          </div>
        )}

        {/* Move error */}
        {moveError && (
          <p className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-xs font-semibold text-destructive">
            {moveError}
          </p>
        )}

        {/* Play area */}
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
              onGuess={handleGuess}
            />
          ) : isPong ? (
            <PongPlay
              state={pongState!}
              status={status}
              myMarker={myMarker!}
              onShot={handleShot}
            />
          ) : isTwentyQuestions ? (
            <TwentyQuestionsPlay
              state={tqState!}
              status={status}
              myMarker={myMarker!}
              onSubmit={handleTqMove}
            />
          ) : (
            <TicTacToePlay
              state={state}
              status={status}
              myMarker={myMarker!}
              onMove={handleMove}
            />
          )}
        </div>

        {/* Result screen: Play Again + inline feedback */}
        {isOver && status === "completed" && (
          <div className="mt-8 rounded-3xl border border-border bg-card p-6 text-center shadow-sm">
            <h2 className="text-2xl font-black tracking-tight">{resultTitle}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{resultSubtitle}</p>

            {/* Habit banner — a gentle nudge, only after a finished game */}
            {streak > 0 && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/10 px-4 py-2.5">
                <Flame className="size-4 shrink-0 text-primary" />
                <p className="text-sm font-bold text-foreground">
                  {streak === 1
                    ? "Day 1 — every game counts."
                    : `${streak}-day streak — keep the silence going.`}
                </p>
              </div>
            )}

            {/* Rematch offer from the opponent, else Play Again */}
            {rematch && rematch.by !== deviceToken ? (
              <Button
                className="mt-5 w-full rounded-full py-6 text-base font-bold"
                onClick={() => navigate(`/play/${rematch.slug}`)}
              >
                <RefreshCw className="size-4" />
                Your friend started a rematch — join it
              </Button>
            ) : (
              <Button
                className="mt-5 w-full rounded-full py-6 text-base font-bold"
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

            {/* Inline feedback — one question, right on the result screen */}
            <div className="mt-6 border-t border-border pt-5">
              <p className="text-sm font-bold">Would you play again?</p>
              {feedbackSent === null ? (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFeedback(true)}
                    className="flex h-10 w-16 items-center justify-center gap-1.5 rounded-full bg-primary text-sm font-bold text-white transition-transform hover:scale-105"
                  >
                    <Check className="size-4" /> Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback(false)}
                    className="flex h-10 w-16 items-center justify-center rounded-full border border-border bg-background text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    No
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm font-semibold text-primary">
                  {feedbackSent
                    ? "Thanks — see you next round!"
                    : "Thanks — noted. 👀"}
                </p>
              )}
            </div>

            {/* Subtle A2HS prompt — only after a finished game, never on load */}
            <InstallPromptModal
              renderTrigger={(open) => (
                <button
                  type="button"
                  onClick={open}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  📲 Add Recess to Home Screen
                </button>
              )}
            />
          </div>
        )}
      </main>

      {/* Floating video overlay — draggable, resizable, PiP-capable */}
      <FloatingVideo />
    </div>
  );
}
