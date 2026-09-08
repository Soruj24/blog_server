import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import type { AuthRequest } from "../middlewares/requireAuth.js";
import * as engagementService from "../services/engagement.service.js";

function requireUserId(req: AuthRequest): string {
  if (!req.userId) throw { status: 401, message: "Unauthorized" };
  return req.userId;
}

/** POST /articles/:slug/like */
export const toggleLike = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await engagementService.toggleLike(requireUserId(req), req.params["slug"] as string));
});

/** POST /articles/:slug/bookmark */
export const toggleBookmark = asyncHandler(async (req: AuthRequest, res: Response) => {
  const folder = (req.body as { folder?: string } | undefined)?.folder;
  return ok(
    res,
    await engagementService.toggleBookmark(requireUserId(req), req.params["slug"] as string, folder),
  );
});

/** GET /articles/:slug/state */
export const engagementState = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(
    res,
    await engagementService.engagementState(requireUserId(req), req.params["slug"] as string),
  );
});

/** GET /articles/:slug/comments — public, personalized when authed. */
export const listComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await engagementService.listComments(
      req.params["slug"] as string,
      Number(q["page"] ?? 1),
      Number(q["limit"] ?? 10),
      req.userId ? { id: req.userId, role: req.userRole } : undefined,
      q["filter"] as "pending" | "all" | undefined,
    ),
  );
});

/** POST /articles/:slug/comments */
export const addComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as { content: string; parent?: string };
  return ok(
    res,
    await engagementService.addComment(
      requireUserId(req),
      req.params["slug"] as string,
      body.content,
      body.parent,
    ),
    201,
  );
});

/** POST /articles/:slug/views */
export const trackView = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as { viewerId: string; referrer?: string };
  return ok(
    res,
    await engagementService.trackView(req.params["slug"] as string, body.viewerId, body.referrer),
  );
});

/** GET /articles/:slug/related */
export const relatedPosts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await engagementService.relatedPosts(req.params["slug"] as string, Number(q["limit"] ?? 3)),
  );
});

/** PATCH /articles/:slug/comments/:id */
export const updateComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as { content: string };
  return ok(
    res,
    await engagementService.updateComment(
      requireUserId(req),
      req.params["slug"] as string,
      req.params["id"] as string,
      body.content,
    ),
  );
});

/** DELETE /articles/:slug/comments/:id */
export const deleteComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(
    res,
    await engagementService.deleteComment(
      requireUserId(req),
      req.params["slug"] as string,
      req.params["id"] as string,
      req.userRole,
    ),
  );
});

/** POST /articles/:slug/comments/:id/like */
export const toggleCommentLike = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(
    res,
    await engagementService.toggleCommentLike(
      requireUserId(req),
      req.params["slug"] as string,
      req.params["id"] as string,
    ),
  );
});

/** POST /articles/:slug/comments/:id/report */
export const reportComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as { reason: string };
  return ok(
    res,
    await engagementService.reportComment(
      requireUserId(req),
      req.params["slug"] as string,
      req.params["id"] as string,
      body.reason,
    ),
  );
});

/** PATCH /articles/:slug/comments/:id/moderate */
export const moderateComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as { status: "approved" | "rejected" | "spam" };
  return ok(
    res,
    await engagementService.moderateComment(
      req.params["slug"] as string,
      req.params["id"] as string,
      body.status,
    ),
  );
});
