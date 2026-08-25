import { useDeviceToken } from "@/hooks/use-device-token";
import { useStreak } from "@/hooks/use-streak";
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
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
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
  TruthOrDareArt,
  TwentyQuestionsArt,
  WordScrambleArt,
} from "@/components/GameArt";

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

interface GameCard {
  name: string;
  blurb: string;
  art: React.ReactNode;
}

/** Map friendly URL game names (?game=...) to the server game type. */
function urlGameToType(raw: string | null): string | null {
  switch (raw) {
    case "tic-tac-toe":
    case "tic_tac_toe":
    case "ttt":
      return "tic_tac_toe";
    case "rock-paper-scissors":
    case "rock_paper_scissors":
    case "rps":
      return "rock_paper_scissors";
    case "red-or-black":
    case "red_or_black":
    case "redblack":
    case "rnb":
      return "red_or_black";
    case "pong":
    case "ping-pong":
    case "ping_pong":
      return "pong";
    case "twenty-questions":
    case "twenty_questions":
    case "20-questions":
    case "tq":
      return "twenty_questions";
    case "hangman":
      return "hangman";
    case "word-scramble":
    case "word_scramble":
    case "scramble":
      return "word_scramble";
    default:
      return null;
  }
}

/** Pull the server's error message out of a ConvexError, if there is one. */
function apiErrorMessage(err: unknown): string | null {
  if (err instanceof ConvexError && typeof err.data === "object" && err.data) {
    const message = (err.data as { message?: string }).message;
    return message ?? null;
  }
  return null;
}

const upcomingGames: GameCard[] = [
  {
    name: "Truth or Dare",
    blurb: "Choose carefully.",
    art: <TruthOrDareArt className="w-full max-w-[92px]" />,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const deviceToken = useDeviceToken();
  const { streak } = useStreak();
  const [creating, setCreating] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [roomGame, setRoomGame] = useState<string>("tic_tac_toe");
  const roomJoinedRef = useRef(false);

  /** Create-or-join a game; with a room slug both players share one link. */
  const handleCreateGame = async (gameType: string, roomSlug?: string) => {
    if (creating) return;
    setCreating(gameType);
    try {
      const { data, error } = await supabase.from('games').insert({ game_type: gameType, device_token: deviceToken }).select('slug').single(); 
      navigate(`/play/${slug}`); const slug = data?.slug;
    navigate(\⁠/play/${slug}`);`
      console.error("Failed to create game:", err);
      toast.error(
        apiErrorMessage(err) ??
          "Couldn't start a game right now. Please try again.",
      );
      setCreating(null);
    }
  };

  const handleOpenRoom = (e: FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim();
    if (!code) return;
    void handleCreateGame(roomGame, code);
  };

  // Open Graph: the bare root link previews as the brand card; a room link
  // (?room=...&game=...) previews as that game's invite card. The inline head
  // script already picked one of these before the bundle loaded — this keeps
  // them correct for SPA re-renders and browsers that re-share the page URL.
  useEffect(() => {
    applyOgMeta(resolveOgMeta(window.location.search));
  }, []);

  // Instant room creation: opening /?room=XYZ&game=tic-tac-toe joins (or
  // creates) that room and drops the player straight into the game. Runs once
  // on mount; create-or-join means both players can open the same room link.
  useEffect(() => {
    if (roomJoinedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room");
    if (!room) return;
    roomJoinedRef.current = true;
    const gameType = urlGameToType(params.get("game"));
    if (!gameType) {
      toast.error(
        "That room link doesn't say which game to play — create one instead.",
      );
      return;
    }
    createGame({ gameType, deviceToken, slug: room })
      .then(({ slug }) => navigate(`/play/${slug}`))
      .catch((err) => {
        console.error("Failed to join room:", err);
        toast.error(apiErrorMessage(err) ?? "Couldn't open that room right now.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Wordmark size="md" />
        <div className="flex items-center gap-3">
          <a
            href="#how-it-works"
            className="hidden text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            How it works
          </a>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
              <Flame className="size-3.5" />
              {streak}-day streak
            </span>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto w-full max-w-5xl px-5 pb-16 pt-10 text-center sm:pt-16">
        {/* Ambient warm glow behind the hero — sets the premium mood */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[36rem] bg-[radial-gradient(62%_55%_at_50%_0%,rgba(245,166,35,0.22),transparent_72%)]"
        />
        {/* The app icon — front and center, like a launcher tile */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.21, 1.02, 0.73, 1] }}
          className="relative mx-auto mb-8 w-fit"
        >
          <div
            aria-hidden
            className="absolute -inset-5 rounded-[3rem] bg-primary/25 blur-2xl"
          />
          <AppIcon
            size="xl"
            className="relative shadow-xl shadow-primary/30 ring-1 ring-foreground/5"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card/80 px-4 py-1.5 text-xs font-semibold text-muted-foreground shadow-chip backdrop-blur-sm"
        >
          <Sparkles className="size-3.5 text-primary" />
          Link-based &middot; No login &middot; Take your turn whenever
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="mx-auto mt-6 max-w-2xl font-display text-5xl font-black tracking-tight sm:text-6xl"
        >
          <Wordmark size="xl" className="justify-center" />
          <span className="mt-3 block bg-gradient-to-b from-[#E08F14] via-primary to-[#F9C877] bg-clip-text text-transparent">
            Silence is safe here.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.12 }}
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Start a game, drop the link in any chat, and your friend plays when
          they&apos;re ready. No accounts. No downloads. No pressure.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            className="h-12 rounded-full px-7 text-base font-bold transition-transform hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => handleCreateGame("tic_tac_toe")}
            disabled={creating !== null}
          >
            {creating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Setting up…
              </>
            ) : (
              <>
                <Gamepad2 className="size-5" />
                Start a game
              </>
            )}
          </Button>
          <a
            href="#games"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-base font-semibold text-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent"
          >
            See the games
            <ArrowRight className="size-4" />
          </a>
        </motion.div>

        {/* Hero image — two phones, one link, a floating controller */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.28 }}
          className="mx-auto mt-12 max-w-md"
        >
          <div className="relative">
            <div
              aria-hidden
              className="absolute inset-4 rounded-[2.5rem] bg-primary/20 blur-2xl"
            />
            <div className="relative rounded-[2.5rem] border border-border bg-card p-6 shadow-lift">
              <HeroArt className="w-full" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* Games */}
      <section id="games" className="mx-auto w-full max-w-5xl px-5 pb-16">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4 }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {/* Tic Tac Toe — the live card */}
          <button
            type="button"
            onClick={() => handleCreateGame("tic_tac_toe")}
            disabled={creating !== null}
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-[1.75rem] border-2 border-primary/60 bg-card p-6 text-left shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lift lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary shadow-chip">
              Ready to play
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-border bg-[#FFF9E5] p-4 shadow-chip">
              <TicTacToeArt className="w-28 sm:w-36" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Tic Tac Toe</h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Three in a row. Pass the link, make a move, and come back when
                it&apos;s your turn — your board waits for you.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 py-2.5 text-sm font-bold text-white shadow-btn-amber transition-all group-hover:translate-x-0.5 group-hover:brightness-105">
              {creating === "tic_tac_toe" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Create game
            </span>
          </button>

          {/* Rock Paper Scissors — the second live card */}
          <button
            type="button"
            onClick={() => handleCreateGame("rock_paper_scissors")}
            disabled={creating !== null}
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-[1.75rem] border-2 border-primary/60 bg-card p-6 text-left shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lift lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary shadow-chip">
              Ready to play
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-border bg-[#FFF9E5] p-4 shadow-chip">
              <RockPaperScissorsArt className="w-28 sm:w-36" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">
                Rock Paper Scissors
              </h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Best of three. Both of you pick in secret, and the picks only
                reveal once they&apos;re both in — no peeking, no arguing.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 py-2.5 text-sm font-bold text-white shadow-btn-amber transition-all group-hover:translate-x-0.5 group-hover:brightness-105">
              {creating === "rock_paper_scissors" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Create game
            </span>
          </button>

          {/* Red or Black — the third live card */}
          <button
            type="button"
            onClick={() => handleCreateGame("red_or_black")}
            disabled={creating !== null}
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-[1.75rem] border-2 border-primary/60 bg-card p-6 text-left shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lift lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary shadow-chip">
              Ready to play
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-border bg-[#FFF9E5] p-4 shadow-chip">
              <RedOrBlackArt className="w-28 sm:w-36" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Red or Black</h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Your friend picks a color, the server deals the card, and the
                reveal lands in an instant. Best of three — guess right to take
                a round.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 py-2.5 text-sm font-bold text-white shadow-btn-amber transition-all group-hover:translate-x-0.5 group-hover:brightness-105">
              {creating === "red_or_black" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Create game
            </span>
          </button>

          {/* Pong — the fourth live card */}
          <button
            type="button"
            onClick={() => handleCreateGame("pong")}
            disabled={creating !== null}
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-[1.75rem] border-2 border-primary/60 bg-card p-6 text-left shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lift lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary shadow-chip">
              Ready to play
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-border bg-[#FFF9E5] p-4 shadow-chip">
              <PongArt className="w-28 sm:w-36" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Pong</h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Classic paddle tennis, by message. Serve an angle, read the
                return, and chase the rally — first to 7 points takes it.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 py-2.5 text-sm font-bold text-white shadow-btn-amber transition-all group-hover:translate-x-0.5 group-hover:brightness-105">
              {creating === "pong" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Create game
            </span>
          </button>

          {/* Hangman — the sixth live card */}
          <button
            type="button"
            onClick={() => handleCreateGame("hangman")}
            disabled={creating !== null}
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-[1.75rem] border-2 border-primary/60 bg-card p-6 text-left shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lift lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary shadow-chip">
              Ready to play
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-border bg-[#FFF9E5] p-4 shadow-chip">
              <HangmanArt className="w-28 sm:w-36" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Hangman</h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                One of you sets a word, the other guesses letters until the
                figure hangs — or the word is found. Six wrong guesses.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 py-2.5 text-sm font-bold text-white shadow-btn-amber transition-all group-hover:translate-x-0.5 group-hover:brightness-105">
              {creating === "hangman" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Create game
            </span>
          </button>

          {/* Word Scramble — the seventh live card */}
          <button
            type="button"
            onClick={() => handleCreateGame("word_scramble")}
            disabled={creating !== null}
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-[1.75rem] border-2 border-primary/60 bg-card p-6 text-left shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lift lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary shadow-chip">
              Ready to play
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-border bg-[#FFF9E5] p-4 shadow-chip">
              <WordScrambleArt className="w-28 sm:w-36" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Word Scramble</h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                One of you picks a word, the server scrambles it, and the other
                has three attempts to unscramble it. No peeking, ever.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 py-2.5 text-sm font-bold text-white shadow-btn-amber transition-all group-hover:translate-x-0.5 group-hover:brightness-105">
              {creating === "word_scramble" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Create game
            </span>
          </button>

          {/* Twenty Questions — the fifth live card */}
          <button
            type="button"
            onClick={() => handleCreateGame("twenty_questions")}
            disabled={creating !== null}
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-[1.75rem] border-2 border-primary/60 bg-card p-6 text-left shadow-soft transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lift lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary shadow-chip">
              Ready to play
            </div>
            <div className="flex items-center justify-center rounded-2xl border border-border bg-[#FFF9E5] p-4 shadow-chip">
              <TwentyQuestionsArt className="w-28 sm:w-36" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">
                Twenty Questions
              </h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                One of you thinks of something, the other asks yes/no questions
                until the guess lands — or the 20 questions run out.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 py-2.5 text-sm font-bold text-white shadow-btn-amber transition-all group-hover:translate-x-0.5 group-hover:brightness-105">
              {creating === "twenty_questions" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Create game
            </span>
          </button>

          {/* Coming soon — each game gets its illustration */}
          {upcomingGames.map((game) => (
            <div
              key={game.name}
              className="col-span-2 flex flex-col gap-4 rounded-3xl border border-dashed border-border bg-card/60 p-6 opacity-80 shadow-soft transition-all hover:-translate-y-0.5 hover:opacity-100"
            >
              <div className="flex h-28 items-center justify-center rounded-2xl border border-border bg-[#FFF9E5] p-4 shadow-chip">
                {game.art}
              </div>
              <div>
                <span className="inline-flex w-fit rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                  Coming soon
                </span>
                <h3 className="mt-2.5 font-display text-lg font-black tracking-tight">
                  {game.name}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {game.blurb}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Open a room by code */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-16">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-center gap-5 rounded-3xl border border-border bg-card p-6 text-center shadow-soft sm:flex-row sm:justify-between sm:text-left sm:p-8"
        >
          <div>
            <h2 className="flex items-center justify-center gap-2 font-display text-lg font-black tracking-tight sm:justify-start">
              <LogIn className="size-5 text-primary" />
              Have a room code?
            </h2>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Paste it to jump straight into a game — both of you share the
              same room link.
            </p>
          </div>
          <form
            onSubmit={handleOpenRoom}
            className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
          >
            <input
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Room code (e.g. sunny-4c)"
              aria-label="Room code"
              className="h-11 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm font-semibold text-foreground shadow-chip outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex flex-wrap items-center justify-center gap-1 rounded-full border border-border bg-background p-1 shadow-chip">
              {(
                [
                  ["tic_tac_toe", "Tic Tac Toe"],
                  ["rock_paper_scissors", "RPS"],
                  ["red_or_black", "Red/Black"],
                  ["pong", "Pong"],
                  ["twenty_questions", "20 Qs"],
                  ["hangman", "Hangman"],
                  ["word_scramble", "Scramble"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRoomGame(value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                    roomGame === value
                      ? "bg-gradient-to-b from-primary to-primary-deep text-white shadow-btn-amber"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={creating !== null || roomCode.trim().length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-5 text-sm font-bold text-white shadow-btn-amber transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:pointer-events-none disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              Open room
            </button>
          </form>
        </motion.div>
      </section>

      {/* Brand mood — the swing set */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-16">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4 }}
          className="grid items-center gap-8 overflow-hidden rounded-[2.5rem] border border-border bg-card p-8 shadow-soft sm:p-10 lg:grid-cols-[1.1fr_1fr]"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" />
              The Recess mood
            </span>
            <h2 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-4xl">
              Play at the pace of a playground.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Recess is built for the slow, quiet, human pace of chat. No
              timers, no accounts, no pressure — just a link between two people
              who have other things going on.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                No timers
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                No accounts
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                No pressure
              </span>
            </div>
          </div>
          <div className="flex items-center justify-center rounded-3xl bg-background p-6">
            <SwingSetArt className="w-full max-w-sm" />
          </div>
        </motion.div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="border-y border-border bg-card/50">
        <div className="mx-auto w-full max-w-5xl px-5 py-16">
          <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
            <h2 className="text-center font-display text-3xl font-black tracking-tight">
              How Recess works
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
              No sign-ups, no friend lists — just a link and a little patience.
            </p>
          </motion.div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Create a game",
                body: "Tap a game, and Recess makes you a private link in one step.",
              },
              {
                step: "2",
                title: "Share it anywhere",
                body: "Paste the link in WhatsApp, Telegram, or any chat. It even previews nicely.",
              },
              {
                step: "3",
                title: "Play at your own pace",
                body: "Your friend taps, joins, and you trade turns whenever you're both free.",
              },
            ].map((s, i) => (
              <motion.div
                key={s.step}
                {...fadeUp}
                transition={{ duration: 0.4, delay: 0.08 * i }}
                className="rounded-3xl bg-card p-6 shadow-soft"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-b from-primary to-primary-deep text-base font-black text-white shadow-btn-amber">
                  {s.step}
                </div>
                <h3 className="mt-4 text-lg font-black tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 px-5 py-10 text-center">
        <Wordmark size="sm" />
        <p className="text-sm text-muted-foreground">
          Silence is safe here.
        </p>
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
      </footer>
    </div>
  );
}
