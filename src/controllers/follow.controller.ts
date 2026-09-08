import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import type { AuthRequest } from "../middlewares/requireAuth.js";
import * as followService from "../services/follow.service.js";

function requireUserId(req: AuthRequest): string {
  if (!req.userId) throw { status: 401, message: "Unauthorized" };
  return req.userId;
}

/** POST /follows/:username/toggle */
export const toggleFollow = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(
    res,
    await followService.toggleFollow(requireUserId(req), req.params["username"] as string),
  );
});

/** GET /follows/:username/state */
export const followState = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(
    res,
    await followService.followState(requireUserId(req), req.params["username"] as string),
  );
});
