import { useCallback, useEffect, useRef, useState } from "react";
import { createLiveSession, type LiveSession } from "@/lib/live/session";
import type { LiveConnectionState } from "@/lib/live/types";
import { GameDataChannel } from "@/lib/live/data-channel";
import type { LiveWireV1 } from "@/lib/live/wire";
import { LIVE_CHANNEL_LABEL } from "@/lib/live/wire";
import { resolveIceServers } from "@/lib/live/ice";

export type UseLiveGameOptions = {
  slug: string;
  deviceToken: string;
  marker: "X" | "O";
  enabled: boolean;
  onRemoteMessage?: (msg: LiveWireV1) => void;
};

export type UseLiveGameResult = {
  connectionState: LiveConnectionState | "idle";
  signalStatus: string | null;
  channelOpen: boolean;
  gameChannel: GameDataChannel | null;
  remoteAxis: number | null;
  start: () => void;
  hangup: () => Promise<void>;
  sendInput: (axis: number) => boolean;
  sendEvent: (kind: "pause" | "resume" | "forfeit" | "ready") => boolean;
};

export function useLiveGame(opts: UseLiveGameOptions): UseLiveGameResult {
  const [connectionState, setConnectionState] = useState<
    LiveConnectionState | "idle"
  >("idle");
  const [signalStatus, setSignalStatus] = useState<string | null>(null);
  const [channelOpen, setChannelOpen] = useState(false);
  const [gameChannel, setGameChannel] = useState<GameDataChannel | null>(null);
  const [remoteAxis, setRemoteAxis] = useState<number | null>(null);

  const sessionRef = useRef<LiveSession | null>(null);
  const onRemoteRef = useRef(opts.onRemoteMessage);
  onRemoteRef.current = opts.onRemoteMessage;
  const startingRef = useRef(false);

  const dispose = useCallback(() => {
    sessionRef.current?.dispose();
    sessionRef.current = null;
    setGameChannel(null);
    setChannelOpen(false);
    setRemoteAxis(null);
    setConnectionState("idle");
    startingRef.current = false;
  }, []);

  const start = useCallback(() => {
    if (sessionRef.current || startingRef.current) return;
    if (!opts.slug || !opts.deviceToken) return;
    startingRef.current = true;
    setConnectionState("signaling");

    void (async () => {
      try {
        const iceServers = await resolveIceServers();
        if (sessionRef.current) return;

        const session = createLiveSession({
          slug: opts.slug,
          deviceToken: opts.deviceToken,
          marker: opts.marker,
          iceServers,
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
              onMessage: (msg) => {
                if (msg.type === "input" && typeof msg.axis === "number") {
                  setRemoteAxis(Math.max(-1, Math.min(1, msg.axis)));
                }
                onRemoteRef.current?.(msg);
              },
            });
            setGameChannel(wrapped);
          },
        });

        sessionRef.current = session;
        session.start();
      } catch (err) {
        console.warn("[Recess live] start failed", err);
        setConnectionState("failed");
        startingRef.current = false;
      }
    })();
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
    remoteAxis,
    start,
    hangup,
    sendInput,
    sendEvent,
  };
}
