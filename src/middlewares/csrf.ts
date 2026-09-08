import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

/** Defense in depth for CSRF: state-changing requests must have Origin == CLIENT_URL if Origin present */
export function csrfOriginCheck(req: Request, res: Response, next: NextFunction) {
  if (["POST", "PATCH", "DELETE", "PUT"].includes(req.method)) {
    const origin = req.headers.origin as string | undefined;
    if (origin && origin !== env.CLIENT_URL) {
      return res.status(403).json({ success: false, message: "Forbidden: invalid origin" });
    }
  }
  next();
}
