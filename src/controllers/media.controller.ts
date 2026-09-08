import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import type { AuthRequest } from "../middlewares/requireAuth.js";
import * as mediaService from "../services/media.service.js";

function requireUserId(req: AuthRequest): string {
  if (!req.userId) throw { status: 401, message: "Unauthorized" };
  return req.userId;
}

function isAdminRole(role?: string): boolean {
  return role === "admin";
}

/** GET /media — my library */
export const listMyMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await mediaService.listUserMedia(requireUserId(req), {
      page: Number(q["page"] ?? 1),
      limit: Number(q["limit"] ?? 20),
      search: q["search"],
      usage: q["usage"],
      format: q["format"],
    }),
  );
});

/** GET /media/:id */
export const getMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  const media = await mediaService.getMediaById(
    req.params["id"] as string,
    requireUserId(req),
    isAdminRole(req.userRole),
  );
  return ok(res, media);
});

/** PATCH /media/:id */
export const updateMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as { alt?: string; usage?: string; folder?: string };
  return ok(
    res,
    await mediaService.updateMedia(
      req.params["id"] as string,
      requireUserId(req),
      isAdminRole(req.userRole),
      body,
    ),
  );
});

/** DELETE /media/:id — owner or admin */
export const deleteMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(
    res,
    await mediaService.deleteMediaWithAuth(
      req.params["id"] as string,
      requireUserId(req),
      isAdminRole(req.userRole),
    ),
  );
});
