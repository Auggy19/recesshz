import { useCallback, useEffect, useState } from "react";
import { subscribeGame } from "@/lib/games-api";
import { ApiError } from "@/lib/api-error";
import { ConvexError } from "@/shims/convex-values";

type Fn = (...args: any[]) => Promise<any>;

export function useMutation(fn: Fn | unknown) {
  const impl: Fn =
    typeof fn === "function"
      ? (fn as Fn)
      : async () => {
          throw new ConvexError({ message: "Unknown mutation" });
        };

  return useCallback(
    async (args: any) => {
      try {
        return await impl(args);
      } catch (err) {
        if (err instanceof ApiError) {
          throw new ConvexError({ code: err.code, message: err.message });
        }
        throw err;
      }
    },
    [impl],
  );
}

export function useQuery_experimental(options: {
  query: Fn | unknown;
  args: any | "skip";
}) {
  const { query, args } = options;
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<unknown>(null);
  const argsKey = args === "skip" ? "skip" : JSON.stringify(args);

  const run = useCallback(async () => {
    if (args === "skip") {
      setStatus("loading");
      setData(null);
      return;
    }
    const impl = typeof query === "function" ? (query as Fn) : null;
    if (!impl) {
      setError(new ConvexError({ message: "Unknown query" }));
      setStatus("error");
      return;
    }
    try {
      const next = await impl(args);
      setData(next);
      setStatus("success");
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(new ConvexError({ code: err.code, message: err.message }));
      } else {
        setError(err);
      }
      setStatus("error");
    }
  }, [query, args, argsKey]);

  useEffect(() => {
    void run();
  }, [run]);

  useEffect(() => {
    if (args === "skip" || !args?.slug) return;
    const unsub = subscribeGame(args.slug, () => {
      void run();
    });
    const interval = window.setInterval(() => void run(), 4000);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, [args === "skip" ? null : args?.slug, run]);

  return { status, data, error };
}

export function useQuery(fn: Fn | unknown, args?: any) {
  const [data, setData] = useState<any>(undefined);
  useEffect(() => {
    if (typeof fn !== "function") {
      setData(null);
      return;
    }
    let cancelled = false;
    (fn as Fn)(args)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fn, JSON.stringify(args)]);
  return data;
}

export function useConvexAuth() {
  return { isLoading: false, isAuthenticated: false };
}
