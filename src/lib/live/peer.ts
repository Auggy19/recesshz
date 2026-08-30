/**
 * Perfect Negotiation peer (Jan-Ivar / W3C pattern).
 * Handles offer glare when both sides call createOffer.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation
 */
import type {
  LiveConnectionState,
  PerfectNegotiationOptions,
  SignalMessage,
} from "@/lib/live/types";

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

function mapPcState(pc: RTCPeerConnection): LiveConnectionState {
  switch (pc.connectionState) {
    case "new":
    case "connecting":
      return "connecting";
    case "connected":
      return "connected";
    case "disconnected":
      return "disconnected";
    case "failed":
      return "failed";
    case "closed":
      return "closed";
    default:
      return "signaling";
  }
}

export class PerfectNegotiationPeer {
  readonly pc: RTCPeerConnection;
  readonly localPeerId: string;
  readonly polite: boolean;
  private _sessionId: string;
  get sessionId(): string {
    return this._sessionId;
  }

  private readonly send: PerfectNegotiationOptions["send"];
  private readonly onDataChannel?: PerfectNegotiationOptions["onDataChannel"];
  private readonly onConnectionState?: PerfectNegotiationOptions["onConnectionState"];
  private readonly dataChannelLabel: string;

  private makingOffer = false;
  private ignoreOffer = false;
  private isSettingRemoteAnswerPending = false;
  private closed = false;
  private localDataChannel: RTCDataChannel | null = null;

  constructor(opts: PerfectNegotiationOptions) {
    this.localPeerId = opts.localPeerId;
    this.polite = opts.polite;
    this._sessionId = opts.sessionId;
    this.send = opts.send;
    this.onDataChannel = opts.onDataChannel;
    this.onConnectionState = opts.onConnectionState;
    this.dataChannelLabel = opts.dataChannelLabel ?? "game";

    this.pc = new RTCPeerConnection({
      iceServers: opts.iceServers?.length ? opts.iceServers : DEFAULT_ICE,
    });

    this.pc.onicecandidate = (ev) => {
      if (!ev.candidate || this.closed) return;
      void this.send({
        v: 1,
        type: "ice",
        from: this.localPeerId,
        sessionId: this.sessionId,
        candidate: ev.candidate.toJSON(),
      });
    };

    this.pc.onconnectionstatechange = () => {
      if (this.closed) return;
      this.onConnectionState?.(mapPcState(this.pc));
    };

    this.pc.ondatachannel = (ev) => {
      this.wireChannel(ev.channel);
    };

    // Perfect negotiation: renegotiate whenever the stack needs it.
    this.pc.onnegotiationneeded = () => {
      void this.onNegotiationNeeded();
    };
  }

  /** Create the outbound game channel (usually the impolite / offering side). */
  createDataChannel(label = this.dataChannelLabel): RTCDataChannel {
    const ch = this.pc.createDataChannel(label, { ordered: true });
    this.localDataChannel = ch;
    this.wireChannel(ch);
    return ch;
  }

  get dataChannel(): RTCDataChannel | null {
    return this.localDataChannel;
  }

  /** Answerer adopts the offerer's session id after live-hello / first SDP. */
  adoptSessionId(id: string): void {
    if (id && id !== this._sessionId) {
      this._sessionId = id;
    }
  }

  /** Feed inbound signaling messages from Supabase Broadcast. */
  async handleSignal(msg: SignalMessage): Promise<void> {
    if (this.closed) return;
    if (msg.from === this.localPeerId) return;
    // Drop messages from a previous live attempt once we have a locked session.
    if (
      msg.sessionId !== this.sessionId &&
      msg.type !== "sdp-offer" &&
      msg.type !== "live-hello"
    ) {
      return;
    }
    if (msg.type === "sdp-offer" || msg.type === "live-hello") {
      this.adoptSessionId(msg.sessionId);
    }
    if (msg.sessionId !== this.sessionId) return;

    try {
      if (msg.type === "sdp-offer") {
        await this.onRemoteOffer(msg.sdp);
      } else if (msg.type === "sdp-answer") {
        await this.onRemoteAnswer(msg.sdp);
      } else if (msg.type === "ice") {
        await this.onRemoteIce(msg.candidate);
      } else if (msg.type === "live-hangup") {
        this.close();
        this.onConnectionState?.("closed");
      }
    } catch (err) {
      console.warn("[Recess live] signal handling error", err);
      this.onConnectionState?.("failed");
    }
  }

  /** Kick off negotiation by ensuring a local data channel exists (triggers negotiationneeded). */
  startAsOfferer(): void {
    if (!this.localDataChannel) {
      this.createDataChannel();
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    try {
      this.localDataChannel?.close();
    } catch {
      /* ignore */
    }
    try {
      this.pc.close();
    } catch {
      /* ignore */
    }
  }

  async hangup(reason?: string): Promise<void> {
    try {
      await this.send({
        v: 1,
        type: "live-hangup",
        from: this.localPeerId,
        sessionId: this.sessionId,
        reason,
      });
    } finally {
      this.close();
      this.onConnectionState?.("closed");
    }
  }

  // --- Perfect Negotiation internals ---------------------------------------

  private async onNegotiationNeeded(): Promise<void> {
    if (this.closed) return;
    try {
      this.makingOffer = true;
      this.onConnectionState?.("signaling");
      await this.pc.setLocalDescription();
      const sdp = this.pc.localDescription?.sdp;
      if (!sdp) return;
      await this.send({
        v: 1,
        type: "sdp-offer",
        from: this.localPeerId,
        sessionId: this.sessionId,
        sdp,
      });
    } catch (err) {
      console.warn("[Recess live] negotiationneeded failed", err);
    } finally {
      this.makingOffer = false;
    }
  }

  private async onRemoteOffer(sdp: string): Promise<void> {
    const offerCollision =
      this.makingOffer ||
      this.pc.signalingState !== "stable" ||
      this.isSettingRemoteAnswerPending;

    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) {
      // Impolite peer keeps its own offer; remote offer is ignored.
      return;
    }

    this.onConnectionState?.("signaling");

    if (offerCollision) {
      // Polite peer: roll back local offer, then accept remote.
      await Promise.all([
        this.pc.setLocalDescription({ type: "rollback" }),
        this.pc.setRemoteDescription({ type: "offer", sdp }),
      ]);
    } else {
      await this.pc.setRemoteDescription({ type: "offer", sdp });
    }

    await this.pc.setLocalDescription();
    const answer = this.pc.localDescription?.sdp;
    if (!answer) return;
    await this.send({
      v: 1,
      type: "sdp-answer",
      from: this.localPeerId,
      sessionId: this.sessionId,
      sdp: answer,
    });
  }

  private async onRemoteAnswer(sdp: string): Promise<void> {
    this.isSettingRemoteAnswerPending = true;
    try {
      await this.pc.setRemoteDescription({ type: "answer", sdp });
    } finally {
      this.isSettingRemoteAnswerPending = false;
    }
  }

  private async onRemoteIce(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      // Candidate may arrive before remote description; ignore if we intentionally dropped an offer.
      if (!this.ignoreOffer) {
        console.warn("[Recess live] addIceCandidate failed", err);
      }
    }
  }

  private wireChannel(channel: RTCDataChannel): void {
    if (channel.label === this.dataChannelLabel) {
      this.localDataChannel = channel;
    }
    channel.binaryType = "arraybuffer";
    this.onDataChannel?.(channel);
  }
}

/** Derive polite peer: O is polite, or lower peerId if markers match. */
export function isPolitePeer(
  localMarker: "X" | "O",
  localPeerId: string,
  remotePeerId?: string,
): boolean {
  if (localMarker === "O") return true;
  if (localMarker === "X") return false;
  if (remotePeerId) return localPeerId < remotePeerId;
  return false;
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

export function createPeerId(deviceToken: string): string {
  // Short stable-ish id for this tab (not a security boundary).
  const suffix = Math.random().toString(36).slice(2, 8);
  const head = deviceToken.slice(0, 8);
  return `${head}-${suffix}`;
}
