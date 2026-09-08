import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import type { AuthRequest } from "../middlewares/requireAuth.js";
import * as postWrite from "../services/postWrite.service.js";
import * as mediaService from "../services/media.service.js";

function requireUserId(req: AuthRequest): string {
  if (!req.userId) throw { status: 401, message: "Unauthorized" };
  return req.userId;
}

/** POST /articles — create post */
export const createPost = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await postWrite.createPost(requireUserId(req), req.userRole, req.body);
  return ok(res, post, 201);
});

/** PATCH /articles/:id — update post */
export const updatePost = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await postWrite.updatePost(req.params["id"] as string, requireUserId(req), req.userRole, req.body);
  return ok(res, post);
});

/** GET /articles/:id/edit — get for editing (owner or admin) */
export const getPostForEdit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await postWrite.getPostForEdit(req.params["id"] as string, requireUserId(req), req.userRole);
  return ok(res, post);
});

/** GET /articles/mine/list — own posts for dashboard */
export const listMyPosts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const result = await postWrite.listMyPosts(requireUserId(req), {
    page: q["page"] ? Number(q["page"]) : 1,
    limit: q["limit"] ? Number(q["limit"]) : 10,
    status: q["status"],
    search: q["search"],
  });
  return ok(res, result);
});

/** POST /media/upload — cover image upload with metadata */
export const uploadCover = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = requireUserId(req);
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw { status: 400, message: "No image file provided" };
  const alt = (req.body?.alt as string | undefined)?.slice(0, 200);
  const usage = (req.body?.usage as string | undefined) || "cover";

  // Try Cloudinary, fallback to placeholder for dev — pass alt/usage
  const { uploadImage, uploadImagePlaceholder } = mediaService;
  // Prefer direct upload with metadata when Cloudinary configured
  const { env } = await import("../config/env.js");
  let result: { url: string; publicId: string; mediaId: string };
  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY) {
    result = await uploadImage(userId, file, { alt, usage });
  } else {
    result = await uploadImagePlaceholder(userId, file);
    // patch alt/usage for placeholder
    if (alt || usage !== "cover") {
      const { Media } = await import("../models/Media.js");
      await Media.updateOne({ _id: result.mediaId }, { alt: alt || "", usage });
    }
  }
  return ok(res, result);
});
