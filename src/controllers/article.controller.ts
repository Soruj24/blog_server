import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import * as articleService from "../services/article.service.js";
import type { ListArticlesQuery } from "../validations/article.validation.js";

/**
 * GET /articles — validated query strings arrive uncoerced, so the
 * controller builds the typed filter explicitly (Zod already rejected
 * anything malformed upstream).
 */
export const listArticles = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  const filter: ListArticlesQuery = {
    page: q["page"] ? Number(q["page"]) : 1,
    limit: q["limit"] ? Number(q["limit"]) : 9,
    sort: (q["sort"] as ListArticlesQuery["sort"]) ?? "latest",
    ...(q["category"] ? { category: q["category"] } : {}),
    ...(q["tag"] ? { tag: q["tag"] } : {}),
    ...(q["author"] ? { author: q["author"] } : {}),
    ...(q["search"] ? { search: q["search"] } : {}),
    ...(q["featured"] ? { featured: q["featured"] as "true" | "false" } : {}),
    ...(q["trending"] ? { trending: q["trending"] as "true" | "false" } : {}),
  };
  return ok(res, await articleService.listArticles(filter));
});

/** GET /articles/:slug */
export const getArticleBySlug = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await articleService.getArticleBySlug(req.params["slug"] as string));
});

/** GET /articles/suggest?q= */
export const suggestArticles = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await articleService.suggestArticles(q["q"] as string, q["limit"] ? Number(q["limit"]) : 6),
  );
});
