import type { Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import type { AuthRequest } from "../middlewares/requireAuth.js";
import type { USER_ROLES, USER_STATUSES } from "../models/User.js";
import * as userService from "../services/user.service.js";

function requireUserId(req: AuthRequest): string {
  if (!req.userId) throw { status: 401, message: "Unauthorized" };
  return req.userId;
}

/** GET /users/me */
export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await userService.getMe(requireUserId(req)));
});

/** GET /users/me/stats */
export const getMyStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await userService.getMyStats(requireUserId(req)));
});

/** GET /users/me/bookmarks */
export const listMyBookmarks = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await userService.listMyBookmarks(
      requireUserId(req),
      Number(q["page"] ?? 1),
      Number(q["limit"] ?? 12),
    ),
  );
});

/** GET /users/authors/popular — public, no auth required. */
export const popularAuthors = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const limit = Math.min(Number(q["limit"] ?? 6) || 6, 12);
  return ok(res, await userService.getPopularAuthors(limit));
});

/** PATCH /users/me */
export const updateMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await userService.updateMe(requireUserId(req), req.body));
});

/** PATCH /users/me/profile */
export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await userService.updateProfile(requireUserId(req), req.body));
});

/** GET /users/by-username/:username (public) */
export const getByUsername = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await userService.getByUsername(req.params["username"] as string));
});

/** GET /users/:id (self or admin — enforced in route chain) */
export const getById = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await userService.getById(req.params["id"] as string));
});

/** GET /users (admin) */
export const listUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page, limit, role, status, search } = req.query as Record<string, string>;
  return ok(
    res,
    await userService.listUsers({
      page: Number(page ?? 1),
      limit: Number(limit ?? 20),
      ...(role ? { role: role as (typeof USER_ROLES)[number] } : {}),
      ...(status ? { status: status as (typeof USER_STATUSES)[number] } : {}),
      ...(search ? { search } : {}),
    }),
  );
});

/** PATCH /users/:id (admin) */
export const adminUpdateUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ok(res, await userService.adminUpdateUser(req.params["id"] as string, req.body));
});
