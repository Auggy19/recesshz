import { ApiError } from "@/lib/api-error";

/** Mimic ConvexError so existing UI error handling still works. */
export class ConvexError extends Error {
  data: { code?: string; message?: string };
  constructor(data: { code?: string; message?: string } | string) {
    if (typeof data === "string") {
      super(data);
      this.data = { message: data };
    } else {
      super(data.message ?? "Error");
      this.data = data;
    }
    this.name = "ConvexError";
  }
}

export function toConvexError(err: unknown): never {
  if (err instanceof ApiError) {
    throw new ConvexError({ code: err.code, message: err.message });
  }
  if (err instanceof Error) throw new ConvexError({ message: err.message });
  throw new ConvexError({ message: "Something went wrong." });
}
