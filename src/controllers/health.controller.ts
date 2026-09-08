import type { Request, Response } from "express";
import { ok } from "../utils/ApiResponse.js";

/** Liveness probe — used by frontend, uptime monitors, and deploys. */
export function healthCheck(_req: Request, res: Response) {
  return ok(res, {
    status: "ok",
    service: "inkwell-api",
    time: new Date().toISOString(),
  });
}
