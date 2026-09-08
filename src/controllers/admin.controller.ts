import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import type { AuthRequest } from "../middlewares/requireAuth.js";
import * as adminService from "../services/admin.service.js";
import { adminBulkUserStatus } from "../services/user.service.js";
import type {
  BulkCommentsInput,
  BulkPostsInput,
  BulkUsersInput,
  UpdateSettingsInput,
} from "../validations/admin.validation.js";

/** GET /admin/stats */
export const getStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
  return ok(res, await adminService.getStats());
});

/** GET /admin/posts */
export const listPosts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await adminService.listAdminPosts({
      page: Number(q["page"] ?? 1),
      limit: Number(q["limit"] ?? 20),
      ...(q["status"] ? { status: q["status"] } : {}),
      ...(q["search"] ? { search: q["search"] } : {}),
    }),
  );
});

/** PATCH /admin/posts/bulk */
export const bulkPosts = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await adminService.bulkPosts(req.body as BulkPostsInput));
});

/** GET /admin/comments */
export const listComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await adminService.listAdminComments({
      page: Number(q["page"] ?? 1),
      limit: Number(q["limit"] ?? 20),
      ...(q["status"] ? { status: q["status"] } : {}),
      ...(q["search"] ? { search: q["search"] } : {}),
    }),
  );
});

/** PATCH /admin/comments/bulk */
export const bulkComments = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await adminService.bulkComments(req.body as BulkCommentsInput));
});

/** GET /admin/media */
export const listMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await adminService.listMedia({
      page: Number(q["page"] ?? 1),
      limit: Number(q["limit"] ?? 20),
      ...(q["usage"] ? { usage: q["usage"] } : {}),
      ...(q["search"] ? { search: q["search"] } : {}),
      ...(q["format"] ? { format: q["format"] } : {}),
    }),
  );
});

/** DELETE /admin/media/:id */
export const deleteMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await adminService.deleteMedia(req.params["id"] as string));
});

/** GET /admin/newsletter */
export const listSubscribers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await adminService.listSubscribers({
      page: Number(q["page"] ?? 1),
      limit: Number(q["limit"] ?? 20),
      ...(q["status"] ? { status: q["status"] } : {}),
      ...(q["search"] ? { search: q["search"] } : {}),
    }),
  );
});

/** PATCH /admin/newsletter/:id */
export const updateSubscriber = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { updateSubscriberStatus } = await import("../services/newsletter.service.js");
  const body = req.body as { status: "active" | "unsubscribed" | "bounced" };
  return ok(res, await updateSubscriberStatus(req.params["id"] as string, body.status));
});

/** DELETE /admin/newsletter/:id */
export const deleteSubscriber = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await adminService.deleteSubscriber(req.params["id"] as string));
});

/** PATCH /admin/users/bulk */
export const bulkUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body as BulkUsersInput;
  return ok(res, await adminBulkUserStatus(body.ids, body.status));
});

/** GET /admin/settings */
export const getSettings = asyncHandler(async (_req: AuthRequest, res: Response) => {
  return ok(res, await adminService.getSettings());
});

/** PATCH /admin/settings */
export const updateSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await adminService.updateSettings(req.body as UpdateSettingsInput));
});

/** GET /admin/analytics — supports ?days=1|7|30|90 or ?start=YYYY-MM-DD&end=YYYY-MM-DD */
export const getAnalytics = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  if (q["start"] && q["end"]) {
    return ok(res, await adminService.getAnalytics({ start: q["start"], end: q["end"] }));
  }
  const days = Number(q["days"] ?? 30) as 1 | 7 | 30 | 90;
  return ok(res, await adminService.getAnalytics(days));
});
