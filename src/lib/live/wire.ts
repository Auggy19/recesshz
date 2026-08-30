/**
 * Live game wire protocol over the "game" RTCDataChannel.
 * Channel is unordered + maxRetransmits:0 — every message must be self-contained.
 * Use seq + latest-wins; never rely on delivery order.
 */
export type LiveWireV1 =
  | { v: 1; type: "hello"; marker: "X" | "O"; seq: number; ts: number }
  | { v: 1; type: "input"; seq: number; ts: number; axis: number }
  | { v: 1; type: "state"; seq: number; ts: number; payload: Record<string, unknown> }
  | { v: 1; type: "event"; seq: number; ts: number; kind: "pause" | "resume" | "forfeit" | "ready" }
  | { v: 1; type: "ping"; seq: number; ts: number }
  | { v: 1; type: "pong"; seq: number; ts: number; echo: number };

export const LIVE_CHANNEL_LABEL = "game" as const;

/** SCTP partial-reliability: low latency, gaps OK (latest-wins at app layer). */
export const LIVE_CHANNEL_INIT: RTCDataChannelInit = {
  ordered: false,
  maxRetransmits: 0,
};

export function parseLiveWire(data: unknown): LiveWireV1 | null {
  try {
    const raw =
      typeof data === "string"
        ? data
        : data instanceof ArrayBuffer
          ? new TextDecoder().decode(data)
          : data instanceof Uint8Array
            ? new TextDecoder().decode(data)
            : null;
    if (raw === null) return null;
    const msg = JSON.parse(raw) as LiveWireV1;
    if (!msg || msg.v !== 1 || typeof msg.type !== "string") return null;
    return msg;
  } catch {
    return null;
  }
}
