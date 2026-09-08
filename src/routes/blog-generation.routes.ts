import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import * as v from "../validations/blog-generation.validation.js";
import * as c from "../controllers/blog-generation.controller.js";

const genLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  message: { message: "Blog generation rate limit: 5/min" },
});

const batchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 2,
  message: { message: "Batch generation rate limit: 2/min" },
});

export const blogGenerationRouter = Router();

// All generation routes require auth + author role
blogGenerationRouter.use(requireAuth);

// Generate a single blog post from a topic
blogGenerationRouter.post(
  "/generate",
  genLimiter,
  requireRole("author", "editor", "admin"),
  validate(v.generateBlogSchema),
  c.generateBlogPost,
);

// Generate multiple blog posts in batch
blogGenerationRouter.post(
  "/generate/batch",
  batchLimiter,
  requireRole("editor", "admin"),
  validate(v.generateBlogsSchema),
  c.generateBatch,
);

// Preview generation without saving (for testing)
blogGenerationRouter.post(
  "/preview",
  genLimiter,
  requireRole("author", "editor", "admin"),
  validate(v.previewGenerationSchema),
  c.preview,
);
