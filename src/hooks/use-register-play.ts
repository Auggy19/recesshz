import { useEffect, useRef } from "react";
import { registerPlayOnServer } from "@/lib/registerPlay";
import type { CelebrationKind } from "@/lib/celebration";

/**
 * When a Tic Tac Toe (or any) match flips to over, call recess_register_play
 * once per slug with device token + win/loss.
 */
export function useRegisterPlayOnMatchEnd(args: {
  slug: string;
  deviceToken: string;
  gameType: string;
  isOver: boolean;
  celebration: CelebrationKind | null;
}) {
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (!args.isOver || !args.deviceToken || !args.slug) return;
    if (sent.current === args.slug) return;
    sent.current = args.slug;

    const won = args.celebration === "win";
    void registerPlayOnServer({
      deviceToken: args.deviceToken,
      gameType: args.gameType || "tic_tac_toe",
      score: won ? 1 : 0,
      won,
    });
  }, [
    args.isOver,
    args.slug,
    args.deviceToken,
    args.gameType,
    args.celebration,
  ]);
}
