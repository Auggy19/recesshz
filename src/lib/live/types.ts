/**
 * Live session signaling protocol (WebRTC over Supabase Realtime Broadcast).
 * Keep payloads small — high-frequency game state belongs on the DataChannel.
 */
export type PeerId = string;

export type SignalMessage =
  | { v: 1; type: "live-hello"; from: PeerId; marker: "X" | "O"; sessionId: string }
  | { v: 1; type: "live-ready"; from: PeerId; sessionId: string }
  | { v: 1; type: "sdp-offer"; from: PeerId; sessionId: string; sdp: string }
  | { v: 1; type: "sdp-answer"; from: PeerId; sessionId: string; sdp: string }
  | { v: 1; type: "ice"; from: PeerId; sessionId: string; candidate: RTCIceCandidateInit }
  | { v: 1; type: "live-hangup"; from: PeerId; sessionId: string; reason?: string };

export type LiveConnectionState =
  | "idle"
  | "signaling"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export type PerfectNegotiationOptions = {
  /** Stable id for this tab (hashed device token + random suffix is fine). */
  localPeerId: PeerId;
  /** Polite peer rolls back on offer collision (glare). Use marker O or lower peerId. */
  polite: boolean;
  sessionId: string;
  /** ICE servers — STUN for dev; add TURN from Edge for production. */
  iceServers?: RTCIceServer[];
  /** Called for every outbound signal message. */
  send: (msg: SignalMessage) => void | Promise<void>;
  /** Fired when a data channel is ready (local create or remote). */
  onDataChannel?: (channel: RTCDataChannel) => void;
  /** Connection state changes for UI. */
  onConnectionState?: (state: LiveConnectionState) => void;
  /** Optional label for the primary game data channel. */
  dataChannelLabel?: string;
};
