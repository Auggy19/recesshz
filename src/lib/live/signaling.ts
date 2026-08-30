import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { SignalMessage, PeerId } from "@/lib/live/types";

export type SignalingHandle = {
  channel: RealtimeChannel;
  send: (msg: SignalMessage) => Promise<void>;
  unsubscribe: () => void;
};

/**
 * Join a dedicated live signaling topic for a game room.
 * Uses Broadcast only — not Postgres Changes.
 */
export function connectSignaling(opts: {
  slug: string;
  localPeerId: PeerId;
  onSignal: (msg: SignalMessage) => void;
  onStatus?: (status: string) => void;
}): SignalingHandle {
  if (!isSupabaseConfigured) {
    return {
      channel: null as unknown as RealtimeChannel,
      send: async () => {},
      unsubscribe: () => {},
    };
  }

  const topic = `live:${opts.slug}`;
  const channel = supabase.channel(topic, {
    config: {
      broadcast: { self: false, ack: false },
      presence: { key: opts.localPeerId },
    },
  });

  channel.on("broadcast", { event: "signal" }, ({ payload }) => {
    const msg = payload as SignalMessage;
    if (!msg || typeof msg !== "object" || msg.v !== 1) return;
    if (msg.from === opts.localPeerId) return;
    opts.onSignal(msg);
  });

  channel.subscribe((status) => {
    opts.onStatus?.(status);
  });

  return {
    channel,
    send: async (msg: SignalMessage) => {
      await channel.send({
        type: "broadcast",
        event: "signal",
        payload: msg,
      });
    },
    unsubscribe: () => {
      void supabase.removeChannel(channel);
    },
  };
}
