import { motion } from "framer-motion";
import { Home } from "lucide-react";
import { Link } from "react-router";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground"
    >
      {/* Ambient warm glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[36rem] bg-[radial-gradient(62%_55%_at_50%_0%,rgba(245,166,35,0.22),transparent_72%)]"
      />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/" aria-label="Back to Recess">
          <Wordmark size="md" />
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          <h1 className="font-display text-7xl font-black tracking-tight sm:text-8xl">
            <span className="bg-gradient-to-b from-[#E08F14] via-primary to-[#F9C877] bg-clip-text text-transparent">
              404
            </span>
          </h1>
          <p className="mt-4 font-display text-xl font-bold tracking-tight">
            That page wandered off.
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            The link may be wrong, or the game it pointed to has gone quiet.
            Silence is safe here — head back to the playground.
          </p>
          <Link
            to="/"
            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-primary to-primary-deep px-7 text-base font-bold text-white shadow-btn-amber transition-all hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0"
          >
            <Home className="size-4" />
            Back to Recess
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
