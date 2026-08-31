import { useState } from "react";
import { Bot, Loader2 } from "lucide-react";
import { DifficultyPicker } from "@/components/DifficultyPicker";
import { GameIcon } from "@/components/GameIcon";
import {
  SINGLE_PLAYER_GAMES,
  type SinglePlayerGame,
} from "@/lib/ai";
import type { Difficulty } from "@/lib/design-tokens";
import { getGameEntry } from "@/lib/gameCatalog";
import { Button } from "@/components/ui/button";

type Props = {
  onStart: (gameType: SinglePlayerGame, difficulty: Difficulty) => Promise<void> | void;
  busy?: boolean;
};

export function SoloLaunch({ onStart, busy }: Props) {
  const [game, setGame] = useState<SinglePlayerGame>("tic_tac_toe");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary-deep text-white shadow-btn-amber">
          <Bot className="size-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-black tracking-tight">
            Solo practice
          </h2>
          <p className="text-xs text-muted-foreground">
            Train against Recess AI — no link required.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SINGLE_PLAYER_GAMES.map((t) => {
          const entry = getGameEntry(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setGame(t)}
              className={
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-all " +
                (game === t
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:text-foreground")
              }
            >
              <GameIcon
                gameType={t}
                size="sm"
                variant={game === t ? "ghost" : "soft"}
              />
              {entry?.shortName ?? t}
            </button>
          );
        })}
      </div>

      <DifficultyPicker
        className="mt-4"
        value={difficulty}
        onChange={setDifficulty}
      />

      <Button
        className="mt-5 h-11 w-full rounded-full font-bold"
        disabled={busy}
        onClick={() => void onStart(game, difficulty)}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Starting…
          </>
        ) : (
          "Play solo"
        )}
      </Button>
    </div>
  );
}
