import { useDeviceToken } from "@/hooks/use-device-token";
import { useStreak } from "@/hooks/use-streak";
import { createGame } from "@/lib/games-api";
import { getApiError } from "@/lib/api-error";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Flame,
  Gamepad2,
  Link2,
  Loader2,
  LogIn,
  MessageCircle,
  Sparkles,
  Bot,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppIcon } from "@/components/AppIcon";
import InstallPromptModal from "@/components/InstallPromptModal";
import { Button } from "@/components/ui/button";
import { applyOgMeta, resolveOgMeta } from "@/lib/og";
import {
  HangmanArt,
  HeroArt,
  PongArt,
  RedOrBlackArt,
  RockPaperScissorsArt,
  SwingSetArt,
  TicTacToeArt,
  TwentyQuestionsArt,
  WordScrambleArt,
} from "@/components/GameArt";
import { GameIcon, GameChip } from "@/components/GameIcon";
import { SoloLaunch } from "@/components/SoloLaunch";
import { supportsSinglePlayer } from "@/lib/ai";
import {
  AVAILABLE_GAMES,
  urlGameToType,
  type SupportedGameType,
} from "@/lib/gameCatalog";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

interface GameCard {
  name: string;
  blurb: string;
  art: React.ReactNode;
}

const GAME_ART: Record<string, React.ReactNode> = {
  tic_tac_toe: <TicTacToeArt className="w-28 sm:w-36" />,
  rock_paper_scissors: <RockPaperScissorsArt className="w-28 sm:w-36" />,
  red_or_black: <RedOrBlackArt className="w-28 sm:w-36" />,
  pong: <PongArt className="w-28 sm:w-36" />,
  hangman: <HangmanArt className="w-28 sm:w-36" />,
  word_scramble: <WordScrambleArt className="w-28 sm:w-36" />,
  twenty_questions: <TwentyQuestionsArt className="w-28 sm:w-36" />,
};

const upcomingGames: GameCard[] = [
  {
    name: "Live Pong",
    blurb:
      "Real-time 2-player Pong over the network — both paddles live, same court. Coming soon.",
    art: <PongArt className="w-full max-w-[92px]" />,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const deviceToken = useDeviceToken();
  const { streak } = useStreak();
  const [creating, setCreating] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [roomGame, setRoomGame] = useState<SupportedGameType>("tic_tac_toe");
  const roomJoinedRef = useRef(false);

  const handleCreateGame = async (gameType: string, roomSlug?: string) => {
    if (creating) return;
    setCreating(gameType);
    try {
      const { slug } = await createGame({
        gameType,
        deviceToken,
        ...(roomSlug ? { slug: roomSlug } : {}),
      });
      navigate(`/play/${slug}`);
    } catch (err) {
      toast.error(getApiError(err).message ?? "Could not start that game");
    } finally {
      setCreating(null);
    }
  };

  const handleJoinRoom = (e: FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim();
    if (!code) {
      toast.error("Enter a room code");
      return;
    }
    void handleCreateGame(roomGame, code);
  };

  useEffect(() => {
    applyOgMeta(resolveOgMeta("/" ));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const join = params.get("join") || params.get("room");
    const game = params.get("game");
    if (join && !roomJoinedRef.current) {
      roomJoinedRef.current = true;
      const type = urlGameToType(game) ?? "tic_tac_toe";
      void handleCreateGame(type, join);
    }
  }, [deviceToken]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-4">
        <Wordmark size="sm" />
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-semibold text-primary">
              <Flame className="size-3.5" /> {streak}
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto w-full max-w-5xl px-5 pb-10 pt-4">
        <motion.div {...fadeUp} transition={{ duration: 0.35 }} className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <AppIcon className="size-16" />
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
            A short game between messages
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground sm:text-base">
            Start a room, send the link, play when you both have a minute. No signup required.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button
              className="rounded-full px-6 py-6 text-base font-bold"
              disabled={!!creating}
              onClick={() => handleCreateGame("tic_tac_toe")}
            >
              {creating === "tic_tac_toe" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Gamepad2 className="size-4" />
              )}
              Quick Tic Tac Toe
            </Button>
            <Button
              variant="outline"
              className="rounded-full px-6 py-6 text-base font-bold"
              onClick={() => navigate("/solo/tic_tac_toe?difficulty=intermediate")}
            >
              <Bot className="size-4" />
              Practice solo
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-12">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Games
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {AVAILABLE_GAMES.map((g) => {
            const art = GAME_ART[g.type];
            const soloOk = supportsSinglePlayer(g.type);
            const busy = creating === g.type;
            return (
              <div
                key={g.type}
                className="flex flex-col rounded-3xl border border-border bg-card p-4 shadow-soft"
              >
                <div className="flex items-start gap-3">
                  <GameIcon type={g.type} className="size-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-lg font-bold">{g.name}</h3>
                      <GameChip type={g.type} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{g.blurb}</p>
                  </div>
                  {art && <div className="hidden shrink-0 sm:block">{art}</div>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="rounded-full font-bold"
                    disabled={!!creating}
                    onClick={() => handleCreateGame(g.type)}
                  >
                    {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                    Play with a friend
                  </Button>
                  {soloOk && (
                    <Button
                      variant="outline"
                      className="rounded-full font-bold"
                      onClick={() =>
                        navigate(
                          g.type === "pong"
                            ? "/solo/pong?difficulty=intermediate"
                            : `/solo/${g.type}?difficulty=intermediate`,
                        )
                      }
                    >
                      Solo
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-5 pb-12">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted-foreground">
          Join a room
        </h2>
        <form
          onSubmit={handleJoinRoom}
          className="flex flex-col gap-2 rounded-3xl border border-border bg-card p-4 shadow-soft sm:flex-row sm:items-end"
        >
          <label className="flex-1 text-left text-xs font-semibold text-muted-foreground">
            Room code
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
              placeholder="Paste code or link slug"
              autoComplete="off"
            />
          </label>
          <Button type="submit" className="rounded-full font-bold" disabled={!!creating}>
            <LogIn className="size-4" />
            Join
          </Button>
        </form>
      </section>

      <section id="solo" className="mx-auto w-full max-w-5xl px-5 pb-16">
        <SoloLaunch
          onLaunch={(gameType, difficulty) => {
            navigate(`/solo/${gameType}?difficulty=${difficulty}`);
          }}
        />
      </section>

      {upcomingGames.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-5 pb-12">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Coming soon
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcomingGames.map((g) => (
              <div
                key={g.name}
                className="flex items-center gap-3 rounded-3xl border border-dashed border-border bg-card/60 p-4"
              >
                <div className="w-16 shrink-0">{g.art}</div>
                <div>
                  <p className="font-bold">{g.name}</p>
                  <p className="text-sm text-muted-foreground">{g.blurb}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-5 py-10 text-center">
        <Wordmark size="sm" />
        <p className="text-sm text-muted-foreground">Silence is safe here.</p>
        <InstallPromptModal
          renderTrigger={(open) => (
            <button
              type="button"
              onClick={open}
              className="mt-1 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground shadow-chip transition-colors hover:text-foreground"
            >
              📲 Add Recess to Home Screen
            </button>
          )}
        />
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <MessageCircle className="size-3.5" />
          Built for the slow, quiet, human pace of chat.
        </p>
        <p className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground/80">
          <Link to="/terms" className="underline-offset-2 hover:text-foreground hover:underline">
            Terms
          </Link>
          <Link to="/privacy" className="underline-offset-2 hover:text-foreground hover:underline">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  );
}
