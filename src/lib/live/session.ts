/**
 * High-level live session: signaling + Perfect Negotiation peer.
 */
import { connectSignaling, type SignalingHandle } from "@/lib/live/signaling";
import {
  PerfectNegotiationPeer,
  createPeerId,
  createSessionId,
  isPolitePeer,
} from "@/lib/live/peer";
import type { LiveConnectionState, SignalMessage } from "@/lib/live/types";

export type LiveSessionOptions = {
  slug: string;
  deviceToken: string;
  marker: "X" | "O";
  /** If true, this side creates the data channel and drives initial offer. */
  offerer?: boolean;
  iceServers?: RTCIceServer[];
  onConnectionState?: (state: LiveConnectionState) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  onSignalStatus?: (status: string) => void;
  onRemoteHangup?: (reason?: string) => void;
};

export type LiveSession = {
  peerId: string;
  sessionId: string;
  peer: PerfectNegotiationPeer;
  signaling: SignalingHandle;
  start: () => void;
  hangup: (reason?: string) => Promise<void>;
  dispose: () => void;
};

/**
 * Wire Supabase Realtime Broadcast ↔ Perfect Negotiation for one room.
 * Call start() once both peers are expected to be on the live channel.
 */
export function createLiveSession(opts: LiveSessionOptions): LiveSession {
  const peerId = createPeerId(opts.deviceToken);
  const sessionId = createSessionId();
  // X offers by default; O is polite answerer.
  const offerer = opts.offerer ?? opts.marker === "X";
  const polite = isPolitePeer(opts.marker, peerId);

  let peerRef: PerfectNegotiationPeer | null = null;

  const signaling = connectSignaling({
    slug: opts.slug,
    localPeerId: peerId,
    onStatus: opts.onSignalStatus,
    onSignal: (msg: SignalMessage) => {
      if (msg.type === "live-hello" && !offerer) {
        peerRef?.adoptSessionId(msg.sessionId);
      }
      if (msg.type === "live-hangup") {
        opts.onRemoteHangup?.(msg.reason);
      }
      void peerRef?.handleSignal(msg);
    },
  });

  const peer = new PerfectNegotiationPeer({
    localPeerId: peerId,
    polite,
    sessionId,
    iceServers: opts.iceServers,
    send: (msg) => signaling.send(msg),
    onDataChannel: opts.onDataChannel,
    onConnectionState: opts.onConnectionState,
  });
  peerRef = peer;

  return {
    peerId,
    sessionId,
    peer,
    signaling,
    start: () => {
      void signaling.send({
        v: 1,
        type: "live-hello",
        from: peerId,
        marker: opts.marker,
        sessionId,
      });
      if (offerer) {
        peer.startAsOfferer();
      }
    },
    hangup: async (reason?: string) => {
      await peer.hangup(reason);
      signaling.unsubscribe();
    },
    dispose: () => {
      peer.close();
      signaling.unsubscribe();
    },
  };
}
