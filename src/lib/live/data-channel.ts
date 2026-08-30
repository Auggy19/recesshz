/**
 * Thin helper around the live "game" DataChannel.
 * Drops sends under backpressure; applies latest-wins on inbound seq.
 */
import {
  LIVE_CHANNEL_LABEL,
  parseLiveWire,
  type LiveWireV1,
} from "@/lib/live/wire";

const DEFAULT_MAX_BUFFERED = 32 * 1024;

export type GameDataChannelHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (msg: LiveWireV1) => void;
  /** Called when a message is ignored due to stale seq (reorder/dup). */
  onStale?: (msg: LiveWireV1) => void;
};

export class GameDataChannel {
  readonly channel: RTCDataChannel;
  private seq = 0;
  private lastRemoteSeq = -1;
  private readonly maxBuffered: number;
  private readonly handlers: GameDataChannelHandlers;

  constructor(
    channel: RTCDataChannel,
    handlers: GameDataChannelHandlers = {},
    maxBuffered = DEFAULT_MAX_BUFFERED,
  ) {
    this.channel = channel;
    this.handlers = handlers;
    this.maxBuffered = maxBuffered;
    channel.binaryType = "arraybuffer";

    channel.onopen = () => this.handlers.onOpen?.();
    channel.onclose = () => this.handlers.onClose?.();
    channel.onmessage = (ev) => {
      const msg = parseLiveWire(ev.data);
      if (!msg) return;
      if (typeof msg.seq === "number") {
        if (msg.seq <= this.lastRemoteSeq) {
          this.handlers.onStale?.(msg);
          return;
        }
        this.lastRemoteSeq = msg.seq;
      }
      this.handlers.onMessage?.(msg);
    };
  }

  get readyState(): RTCDataChannelState {
    return this.channel.readyState;
  }

  get label(): string {
    return this.channel.label || LIVE_CHANNEL_LABEL;
  }

  peekSeq(): number {
    return this.seq + 1;
  }

  send(msg: Omit<LiveWireV1, "seq" | "ts"> & { seq?: number; ts?: number }): boolean {
    if (this.channel.readyState !== "open") return false;
    if (this.channel.bufferedAmount > this.maxBuffered) return false;

    this.seq += 1;
    const full = {
      ...msg,
      seq: msg.seq ?? this.seq,
      ts: msg.ts ?? performance.now(),
    } as LiveWireV1;

    try {
      this.channel.send(JSON.stringify(full));
      return true;
    } catch {
      return false;
    }
  }

  sendHello(marker: "X" | "O"): boolean {
    return this.send({ v: 1, type: "hello", marker });
  }

  sendInput(axis: number): boolean {
    const a = Math.max(-1, Math.min(1, axis));
    return this.send({ v: 1, type: "input", axis: a });
  }

  sendEvent(kind: "pause" | "resume" | "forfeit" | "ready"): boolean {
    return this.send({ v: 1, type: "event", kind });
  }

  sendPing(): boolean {
    return this.send({ v: 1, type: "ping" });
  }
}

export function wrapGameDataChannel(
  channel: RTCDataChannel,
  handlers?: GameDataChannelHandlers,
): GameDataChannel {
  return new GameDataChannel(channel, handlers);
}
