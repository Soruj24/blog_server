import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import { generateBlog, generateBlogs, previewGeneration } from "../ai/services/blog-generation.service.js";

export const generateBlogPost = asyncHandler(async (req: Request, res: Response) => {
  const { topic, context, articleType, saveToDb } = req.body as {
    topic: string;
    context?: string;
    articleType?: string;
    saveToDb: boolean;
  };

  const result = await generateBlog({
    topic,
    context,
    articleType,
    authorUsername: (req as any).user?.username ?? "maya_writes",
    saveToDb,
  });

  return ok(res, {
    status: result.state.status,
    topic: result.state.topic,
    draft: result.state.draft,
    seo: result.state.seo,
    plan: result.state.plan,
    qualityReport: result.state.qualityReport,
    editorialReview: result.state.editorialReview,
    saved: result.saved,
    timings: result.state.agentTimings,
    errors: result.state.errors,
  });
});

export const generateBatch = asyncHandler(async (req: Request, res: Response) => {
  const { topics, count, concurrency } = req.body as {
    topics: string[];
    count?: number;
    concurrency?: number;
  };

  const results = await generateBlogs({
    topics,
    count,
    concurrency,
    authorUsername: (req as any).user?.username ?? "maya_writes",
  });

  return ok(res, {
    total: results.length,
    succeeded: results.filter((r) => r.state.status === "passed").length,
    failed: results.filter((r) => r.state.status === "failed").length,
    results: results.map((r) => ({
      topic: r.state.topic,
      status: r.state.status,
      saved: r.saved,
      timings: r.state.agentTimings,
      errors: r.state.errors,
    })),
  });
});

export const preview = asyncHandler(async (req: Request, res: Response) => {
  const { topic } = req.body as { topic: string };

  const state = await previewGeneration(topic);

  return ok(res, {
    status: state.status,
    topic: state.topic,
    research: state.research,
    plan: state.plan,
    draft: state.draft,
    seo: state.seo,
    editorialReview: state.editorialReview,
    qualityReport: state.qualityReport,
    timings: state.agentTimings,
    errors: state.errors,
  });
});
