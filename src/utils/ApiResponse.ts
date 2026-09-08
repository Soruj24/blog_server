import type { Request, Response } from "express";

/** Consistent success envelope: { success, data }. */
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, data });
}
