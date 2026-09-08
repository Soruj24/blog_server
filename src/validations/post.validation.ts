import { z } from "zod";
import { POST_STATUSES, POST_VISIBILITY } from "../models/Post.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9-]+$/, "Invalid slug");

const baseFields = {
  title: z.string().trim().min(8, "Title must be at least 8 characters").max(150).optional(),
  slug: slugField.optional(),
  excerpt: z.string().trim().min(20, "Excerpt must be at least 20 characters").max(300).optional(),
  content: z.string().trim().min(100, "Content must be at least 100 characters").max(100000).optional(),
  coverImage: z.string().trim().max(1024).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(), // slug or id
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  status: z.enum(POST_STATUSES).optional(),
  visibility: z.enum(POST_VISIBILITY).optional(),
  featured: z.boolean().optional(),
  trending: z.boolean().optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(160).nullable().optional(),
  canonicalUrl: z.string().trim().max(1024).nullable().optional(),
  ogImage: z.string().trim().max(1024).nullable().optional(),
  noIndex: z.boolean().optional(),
  scheduledAt: z.string().trim().nullable().optional(), // ISO string
};

/**
 * POST /articles — create. All fields optional for draft creation,
 * but publish/scheduled will be rejected without required fields in service.
 */
export const createPostSchema = z.object({
  body: z.object(baseFields).strict(),
});

/**
 * PATCH /articles/:id — update. Same fields, all optional.
 * Slug immutability after publish is enforced in service, not here.
 */
export const updatePostSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object(baseFields).strict(),
});

/** GET /articles/:id — fetch for editing (by ObjectId) */
export const getPostByIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export type CreatePostInput = z.infer<typeof createPostSchema>["body"];
export type UpdatePostInput = z.infer<typeof updatePostSchema>["body"];
