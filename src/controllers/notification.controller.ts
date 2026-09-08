import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import type { AuthRequest } from "../middlewares/requireAuth.js";
import * as notificationService from "../services/notification.service.js";

function requireUserId(req: AuthRequest): string {
  if (!req.userId) throw { status: 401, message: "Unauthorized" };
  return req.userId;
}

/** GET /notifications */
export const listNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await notificationService.listNotifications(
      requireUserId(req),
      Number(q["page"] ?? 1),
      Number(q["limit"] ?? 15),
    ),
  );
});

/** PATCH /notifications/:id/read */
export const markRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(
    res,
    await notificationService.markRead(requireUserId(req), req.params["id"] as string),
  );
});

/** PATCH /notifications/read-all */
export const markAllRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await notificationService.markAllRead(requireUserId(req)));
});

/** POST /notifications/announce — admin */
export const announce = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as { title: string; body?: string };
  return ok(res, await notificationService.broadcastSystem(body.title, body.body));
});
