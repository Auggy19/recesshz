export type ErrorCode =
  | "not_found"
  | "expired"
  | "locked"
  | "not_a_player"
  | "invalid_move"
  | "not_ready"
  | "unsupported_game"
  | "invalid_room";

export class ApiError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export function getApiError(err: unknown): { code?: string; message?: string } {
  if (err instanceof ApiError) return { code: err.code, message: err.message };
  if (err instanceof Error) return { message: err.message };
  return { message: "Something went wrong. Please try again." };
}
