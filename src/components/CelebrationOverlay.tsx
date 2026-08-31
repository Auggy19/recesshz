import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CELEBRATION_COPY,
  playCelebration,
  type CelebrationKind,
} from "@/lib/celebration";

type Props = {
  kind: CelebrationKind | null;
  onDone?: () => void;
};

export function CelebrationOverlay({ kind, onDone }: Props) {
  useEffect(() => {
    if (!kind) return;
    playCelebration(kind);
    const t = window.setTimeout(() => onDone?.(), 1600);
    return () => window.clearTimeout(t);
  }, [kind, onDone]);

  return (
    <AnimatePresence>
      {kind && (kind === "win" || kind === "draw" || kind === "loss") && (
        <motion.div
          key={kind}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none fixed inset-x-0 top-[18%] z-[60] flex justify-center px-4"
          aria-live="polite"
        >
          <div
            className={
              "rounded-2xl border px-5 py-3 text-center shadow-lift backdrop-blur-md " +
              (kind === "win"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
                : kind === "draw"
                  ? "border-amber-500/30 bg-amber-500/15 text-amber-950 dark:text-amber-50"
                  : "border-border bg-card/90 text-foreground")
            }
          >
            <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">
              Match
            </p>
            <p className="mt-0.5 font-display text-lg font-black tracking-tight">
              {CELEBRATION_COPY[kind]}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
