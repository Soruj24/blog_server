import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireModerator, optionalAuth } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import {
  articleSlugSchema,
  listArticlesSchema,
  suggestSchema,
} from "../validations/article.validation.js";
import { createPostSchema, getPostByIdSchema, updatePostSchema } from "../validations/post.validation.js";
import {
  bookmarkToggleSchema,
  commentCreateSchema,
  commentDeleteSchema,
  commentLikeSchema,
  commentModerateSchema,
  commentReportSchema,
  commentUpdateSchema,
  commentsListSchema,
  engagementStateSchema,
  likeToggleSchema,
  relatedSchema,
  viewTrackSchema,
} from "../validations/engagement.validation.js";
import * as articleController from "../controllers/article.controller.js";
import * as engagementController from "../controllers/engagement.controller.js";
import * as postWriteController from "../controllers/postWrite.controller.js";

// Engagement abuse guards (tighter than the global /api/ limiter).
const viewLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 });
const commentLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30 });

export const articleRouter = Router();
// NOTE: specific sub-routes before "/:slug" — order matters.
articleRouter.get("/mine/list", requireAuth, postWriteController.listMyPosts);
articleRouter.get("/id/:id", requireAuth, validate(getPostByIdSchema), postWriteController.getPostForEdit);
articleRouter.post("/", requireAuth, writeLimiter, validate(createPostSchema), postWriteController.createPost);
articleRouter.patch("/:id", requireAuth, validate(updatePostSchema), postWriteController.updatePost);
articleRouter.get("/", validate(listArticlesSchema), articleController.listArticles);
// "/suggest" would match "/:slug" — keep it above.
articleRouter.get("/suggest", validate(suggestSchema), articleController.suggestArticles);
articleRouter.get("/:slug/related", validate(relatedSchema), engagementController.relatedPosts);
articleRouter.get(
  "/:slug/comments",
  optionalAuth,
  validate(commentsListSchema),
  engagementController.listComments,
);
articleRouter.post(
  "/:slug/comments",
  commentLimiter,
  requireAuth,
  validate(commentCreateSchema),
  engagementController.addComment,
);
articleRouter.patch(
  "/:slug/comments/:id",
  commentLimiter,
  requireAuth,
  validate(commentUpdateSchema),
  engagementController.updateComment,
);
articleRouter.delete(
  "/:slug/comments/:id",
  requireAuth,
  validate(commentDeleteSchema),
  engagementController.deleteComment,
);
articleRouter.post(
  "/:slug/comments/:id/like",
  writeLimiter,
  requireAuth,
  validate(commentLikeSchema),
  engagementController.toggleCommentLike,
);
articleRouter.post(
  "/:slug/comments/:id/report",
  writeLimiter,
  requireAuth,
  validate(commentReportSchema),
  engagementController.reportComment,
);
articleRouter.patch(
  "/:slug/comments/:id/moderate",
  requireAuth,
  requireModerator,
  validate(commentModerateSchema),
  engagementController.moderateComment,
);
articleRouter.post(
  "/:slug/views",
  viewLimiter,
  validate(viewTrackSchema),
  engagementController.trackView,
);
articleRouter.get(
  "/:slug/state",
  requireAuth,
  validate(engagementStateSchema),
  engagementController.engagementState,
);
articleRouter.post(
  "/:slug/like",
  writeLimiter,
  requireAuth,
  validate(likeToggleSchema),
  engagementController.toggleLike,
);
articleRouter.post(
  "/:slug/bookmark",
  writeLimiter,
  requireAuth,
  validate(bookmarkToggleSchema),
  engagementController.toggleBookmark,
);
articleRouter.get("/:slug", validate(articleSlugSchema), articleController.getArticleBySlug);
