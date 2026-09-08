import { z } from "zod";
import { articleSlugSchema } from "./article.validation.js";

const slugParams = articleSlugSchema.shape.params;
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** POST /articles/:slug/like */
export const likeToggleSchema = z.object({ params: slugParams });

/** POST /articles/:slug/bookmark */
export const bookmarkToggleSchema = z.object({
  params: slugParams,
  body: z.object({ folder: z.string().trim().max(50).optional() }),
});

/** GET /articles/:slug/state */
export const engagementStateSchema = z.object({ params: slugParams });

/** GET /articles/:slug/comments */
export const commentsListSchema = z.object({
  params: slugParams,
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(20).default(10),
    // Moderator-only review filters; rejected server-side otherwise.
    filter: z.enum(["pending", "all"]).optional(),
  }),
});

/** POST /articles/:slug/comments */
export const commentCreateSchema = z.object({
  params: slugParams,
  body: z
    .object({
      content: z.string().trim().min(1, "Comment cannot be empty").max(2000),
      parent: objectId.optional(),
    })
    .strict(),
});

/** POST /articles/:slug/views */
export const viewTrackSchema = z.object({
  params: slugParams,
  body: z.object({
    viewerId: z.string().uuid("Invalid viewer id"),
    referrer: z.string().trim().max(1024).optional(),
  }),
});

/** GET /articles/:slug/related */
export const relatedSchema = z.object({
  params: slugParams,
  query: z.object({
    limit: z.coerce.number().int().min(1).max(6).default(3),
  }),
});

const commentIdParams = slugParams.extend({ id: objectId });

/** PATCH /articles/:slug/comments/:id — owner edit. */
export const commentUpdateSchema = z.object({
  params: commentIdParams,
  body: z
    .object({
      content: z.string().trim().min(1, "Comment cannot be empty").max(2000),
    })
    .strict(),
});

/** DELETE /articles/:slug/comments/:id — owner or moderator. */
export const commentDeleteSchema = z.object({ params: commentIdParams });

/** POST /articles/:slug/comments/:id/like — any signed-in user. */
export const commentLikeSchema = z.object({ params: commentIdParams });

/** POST /articles/:slug/comments/:id/report — one report per user. */
export const commentReportSchema = z.object({
  params: commentIdParams,
  body: z
    .object({
      reason: z.enum(["spam", "harassment", "hate-speech", "misinformation", "other"]),
    })
    .strict(),
});

/** PATCH /articles/:slug/comments/:id/moderate — admin/editor only. */
export const commentModerateSchema = z.object({
  params: commentIdParams,
  body: z
    .object({
      status: z.enum(["approved", "rejected", "spam"]),
    })
    .strict(),
});
