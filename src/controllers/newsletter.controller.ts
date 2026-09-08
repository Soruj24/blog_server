import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import * as newsletterService from "../services/newsletter.service.js";

/** POST /newsletter/subscribe — public, rate-limited, idempotent. */
export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const ip =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    null;
  return ok(res, await newsletterService.subscribe({ ...req.body, ip }));
});

/** POST /newsletter/unsubscribe — public, idempotent */
export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await newsletterService.unsubscribe(req.body));
});
