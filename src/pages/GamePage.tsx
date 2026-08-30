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

// NOTE: Full GamePage restored in follow-up if truncated — see commit message.
export default function GamePage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <p className="p-8 text-center text-sm text-muted-foreground">
        Restoring game page… refresh shortly.
      </p>
    </div>
  );
}
