import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveSession, type LiveSession } from "@/lib/live/session";
import type { LiveConnectionState } from "@/lib/live/types";
import { GameDataChannel } from "@/lib/live/data-channel";
import type { LiveWireV1 } from "@/lib/live/wire";
import { LIVE_CHANNEL_LABEL } from "@/lib/live/wire";

export type UseLiveGameOptions = {
  slug: string;
  deviceToken: string;
  marker: "X" | "O";
  /** When true, prepares lifecycle; call start() to begin negotiation. */
  enabled: boolean;
  onRemoteMessage?: (msg: LiveWireV1) => void;
};

export type UseLiveGameResult = {
  connectionState: LiveConnectionState | "idle";
  signalStatus: string | null;
  channelOpen: boolean;
  gameChannel: GameDataChannel | null;
  start: () => void;
  hangup: () => Promise<void>;
  sendInput: (axis: number) => boolean;
  sendEvent: (kind: "pause" | "resume" | "forfeit" | "ready") => boolean;
};

/**
 * React hook: live session + unordered/unreliable "game" DataChannel.
 */
export function useLiveGame(opts: UseLiveGameOptions): UseLiveGameResult {
  const [connectionState, setConnectionState] = useState<
    LiveConnectionState | "idle"
  >("idle");
  const [signalStatus, setSignalStatus] = useState<string | null>(null);
  const [channelOpen, setChannelOpen] = useState(false);
  const [gameChannel, setGameChannel] = useState<GameDataChannel | null>(null);

  const sessionRef = useRef<LiveSession | null>(null);
  const onRemoteRef = useRef(opts.onRemoteMessage);
  onRemoteRef.current = opts.onRemoteMessage;

  const dispose = useCallback(() => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setGameChannel(null);
    setChannelOpen(false);
    setConnectionState("idle");
  }, []);

  const start = useCallback(() => {
    if (sessionRef.current) return;
    if (!opts.slug || !opts.deviceToken) return;

    const session = createLiveSession({
      slug: opts.slug,
      deviceToken: opts.deviceToken,
      marker: opts.marker,
      onConnectionState: (s) => setConnectionState(s),
      onSignalStatus: (s) => setSignalStatus(s),
      onRemoteHangup: () => {
        setConnectionState("closed");
        setChannelOpen(false);
      },
      onDataChannel: (ch) => {
        if (ch.label && ch.label !== LIVE_CHANNEL_LABEL) return;
        const wrapped = new GameDataChannel(ch, {
          onOpen: () => {
            setChannelOpen(true);
            wrapped.sendHello(opts.marker);
          },
          onClose: () => setChannelOpen(false),
          onMessage: (msg) => onRemoteRef.current?.(msg),
        });
        setGameChannel(wrapped);
      },
    });

    sessionRef.current = session;
    setConnectionState("signaling");
    session.start();
  }, [opts.slug, opts.deviceToken, opts.marker]);

  const hangup = useCallback(async () => {
    await sessionRef.current?.hangup("user");
    dispose();
  }, [dispose]);

  useEffect(() => {
    if (!opts.enabled) {
      dispose();
      return;
    }
    return () => dispose();
  }, [opts.enabled, dispose]);

  const sendInput = useCallback(
    (axis: number) => gameChannel?.sendInput(axis) ?? false,
    [gameChannel],
  );

  const sendEvent = useCallback(
    (kind: "pause" | "resume" | "forfeit" | "ready") =>
      gameChannel?.sendEvent(kind) ?? false,
    [gameChannel],
  );

  return {
    connectionState,
    signalStatus,
    channelOpen,
    gameChannel,
    start,
    hangup,
    sendInput,
    sendEvent,
  };
}
