import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { RockPaperScissorsArt, TicTacToeArt } from "@/components/GameArt";
import TicTacToePlay, {
  type Marker,
  type TicTacToeState,
} from "@/components/games/TicTacToePlay";
import RpsPlay, {
  type RpsChoice,
} from "@/components/games/RpsPlay";
import { api } from "@/convex/_generated/api";
import { useDeviceToken } from "@/hooks/use-device-token";
import {
  useMutation,
  useQuery_experimental as useQuery,
} from "convex/react";
import { ConvexError } from "convex/values";
import {
  ArrowLeft,
  Check,
  Copy,
  Home,
  Loader2,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
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

function setMetaTag(property: string, content: string) {
  let tag = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`,
  );
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
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

  // Join (or re-join) the game with this device's token. Idempotent, so
  // re-opening the link or a retry is safe. New devices on a full game are
  // rejected server-side.
  useEffect(() => {
    let cancelled = false;
    setJoinStatus("joining");
    setJoinError({});
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
  const status: GameStatus | null = game?.status ?? null;
  const state = (game?.state as TicTacToeState) ?? null;
  const rpsState = (game?.state as RpsState) ?? null;
  const myMarker: Marker | null = game?.me?.marker ?? me?.marker ?? null;

  const isOver = isRps
    ? (rpsState?.matchWinner ?? null) !== null
    : state !== null && (state.winner !== null || state.draw);

  const gameLabel = isRps ? "Rock Paper Scissors" : "Tic Tac Toe";

  // Keep the tab title + OG tags fresh for link previews.
  useEffect(() => {
    const invited = status === "waiting";
    document.title = invited
      ? "Recess — you're invited to a game!"
      : `Recess — ${gameLabel}`;
    setMetaTag("og:title", `Recess — ${gameLabel}`);
    setMetaTag(
      "og:description",
      `You've been challenged to a game of Recess (${gameLabel}). Tap to play — silence is safe here.`,
    );
    if (typeof window !== "undefined") {
      setMetaTag("og:image", `${window.location.origin}/og-image.png`);
    }
  }, [status, gameLabel]);

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

  const resultTitle = isRps
    ? rpsState!.matchWinner === myMarker
      ? "You win the match!"
      : "Your friend wins the match"
    : state.winner
      ? state.winner === myMarker
        ? "You win!"
        : "Your friend wins"
      : "It's a draw";

  const resultSubtitle = isRps
    ? `Final score — you ${rpsState!.scores[myMarker!]} · friend ${
        rpsState!.scores[myMarker === "X" ? "O" : "X"]
      }. ${
        rpsState!.matchWinner === myMarker
          ? "Silence never felt so good."
          : "Rematch? The score is right there."
      }`
    : state.draw
      ? "A perfect standoff."
      : state.winner === myMarker
        ? "Silence never felt so good."
        : "Rematch? The board is waiting.";

  // If the opponent started a rematch, offer to follow them; otherwise the
  // usual Play Again button (which also covers rematches I started myself).
  const rematch = (isRps ? rpsState?.rematch : state.rematch) ?? null;

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
          </div>
        )}
      </main>
    </div>
  );
}
