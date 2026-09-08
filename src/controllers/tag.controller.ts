import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import * as tagService from "../services/tag.service.js";

/** GET /tags — public directory (default 50, max 100). */
export const listTags = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const limit = Math.min(Number(q["limit"] ?? 50) || 50, 100);
  return ok(res, await tagService.listTags(limit));
});

/** GET /tags/all — admin (includes unused tags). */
export const listAllTags = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const limit = Math.min(Number(q["limit"] ?? 100) || 100, 200);
  return ok(res, await tagService.listAllTags(limit));
});

/** POST /tags — admin. */
export const createTag = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await tagService.createTag(req.body), 201);
});

/** PATCH /tags/:id — admin. */
export const updateTag = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await tagService.updateTag(req.params["id"] as string, req.body));
});

/** DELETE /tags/:id — admin (?detach=true strips posts first). */
export const deleteTag = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await tagService.removeTag(req.params["id"] as string, q["detach"] === "true"),
  );
});
