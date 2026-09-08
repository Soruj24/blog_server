import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

interface HttpError extends Error {
  status?: number;
  details?: unknown;
}

/** Last middleware. Never leaks stacks in production. */
export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const status = err.status ?? 500;
  if (env.NODE_ENV === "development") console.error(err);
  res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error" : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}
