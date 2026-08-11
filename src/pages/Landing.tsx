import { useDeviceToken } from "@/hooks/use-device-token";
import { api } from "@/convex/_generated/api";
import { useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Gamepad2,
  Link2,
  Loader2,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Wordmark } from "@/components/Wordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/ui/button";
import {
  HeroArt,
  RedOrBlackArt,
  RockPaperScissorsArt,
  SwingSetArt,
  TicTacToeArt,
  TruthOrDareArt,
  TwentyQuestionsArt,
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

const upcomingGames: GameCard[] = [
  {
    name: "Red or Black",
    blurb: "Pick a color. No — the other one.",
    art: <RedOrBlackArt className="w-full max-w-[92px]" />,
  },
  {
    name: "Twenty Questions",
    blurb: "Yes. No. Yes again. Got it!",
    art: <TwentyQuestionsArt className="w-full max-w-[92px]" />,
  },
  {
    name: "Truth or Dare",
    blurb: "Choose carefully.",
    art: <TruthOrDareArt className="w-full max-w-[92px]" />,
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const deviceToken = useDeviceToken();
  const createGame = useMutation(api.games.createGame);
  const [creating, setCreating] = useState<string | null>(null);

  const handleCreateGame = async (gameType: string) => {
    if (creating) return;
    setCreating(gameType);
    try {
      const { slug } = await createGame({ gameType, deviceToken });
      navigate(`/play/${slug}`);
    } catch (err) {
      console.error("Failed to create game:", err);
      toast.error("Couldn't start a game right now. Please try again.");
      setCreating(null);
    }
  };

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
          <ThemeToggle />
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-16 pt-10 text-center sm:pt-16">
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
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-primary" />
          Link-based &middot; No login &middot; Take your turn whenever
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="mx-auto mt-6 max-w-2xl text-5xl font-black tracking-tight sm:text-6xl"
        >
          <Wordmark size="xl" className="justify-center" />
          <span className="mt-3 block text-foreground">Silence is safe here.</span>
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
            className="h-12 rounded-full px-7 text-base font-bold shadow-lg shadow-primary/25"
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
            className="inline-flex h-12 items-center gap-2 rounded-full border border-border bg-card px-6 text-base font-semibold text-foreground transition-colors hover:bg-accent"
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
            <div className="relative rounded-[2.5rem] border border-border bg-card p-6 shadow-xl shadow-primary/10">
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
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-3xl border-2 border-primary bg-card p-6 text-left shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              Ready to play
            </div>
            <div className="rounded-2xl border border-border bg-white p-3">
              <TicTacToeArt className="w-28 sm:w-36" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tight">Tic Tac Toe</h3>
              <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Three in a row. Pass the link, make a move, and come back when
                it&apos;s your turn — your board waits for you.
              </p>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-transform group-hover:translate-x-0.5">
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
            className="group relative col-span-2 flex flex-col items-start gap-4 rounded-3xl border-2 border-primary bg-card p-6 text-left shadow-lg shadow-primary/10 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/20 lg:col-span-2"
          >
            <div className="absolute right-5 top-5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              Ready to play
            </div>
            <div className="rounded-2xl border border-border bg-[#E2E2DF] p-3">
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
            <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-transform group-hover:translate-x-0.5">
              {creating === "rock_paper_scissors" ? (
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
              className="flex flex-col gap-4 rounded-3xl border border-border bg-card/60 p-6 opacity-80 transition-opacity hover:opacity-100"
            >
              <div className="flex h-28 items-center justify-center rounded-2xl border border-border bg-white p-3">
                {game.art}
              </div>
              <div>
                <span className="inline-flex w-fit rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
                  Coming soon
                </span>
                <h3 className="mt-2.5 text-lg font-black tracking-tight">
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

      {/* Brand mood — the swing set */}
      <section className="mx-auto w-full max-w-5xl px-5 pb-16">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.4 }}
          className="grid items-center gap-8 overflow-hidden rounded-[2.5rem] border border-border bg-card p-8 sm:p-10 lg:grid-cols-[1.1fr_1fr]"
        >
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" />
              The Recess mood
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Play at the pace of a playground.
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Recess is built for the slow, quiet, human pace of chat. No
              timers, no streaks, no pressure — just a link between two people
              who have other things going on.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                No timers
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary" />
                No streaks
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
            <h2 className="text-center text-3xl font-black tracking-tight">
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
                className="rounded-3xl bg-card p-6 shadow-sm"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-primary text-base font-black text-white">
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
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <MessageCircle className="size-3.5" />
          Built for the slow, quiet, human pace of chat.
        </p>
      </footer>
    </div>
  );
}
