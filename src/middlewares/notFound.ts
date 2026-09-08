import type { NextFunction, Request, Response } from "express";

/** 404 for unknown /api/v1/* routes. Must sit after all routers. */
export function notFound(_req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({ success: false, message: "Route not found" });
}
