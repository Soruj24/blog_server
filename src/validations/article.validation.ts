import { z } from "zod";

/**
 * Public article discovery. One flexible endpoint powers every feed:
 * - Latest:      GET /articles?sort=latest
 * - Featured:    GET /articles?featured=true
 * - Trending:    GET /articles?trending=true  (or sort=popular)
 * - By category: GET /articles?category=slug
 * - Search:      GET /articles?search=text (weighted title/excerpt/body
 *                 full-text + author/category/tag name resolution)
 */
export const listArticlesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(30).default(9),
    category: z.string().trim().toLowerCase().max(80).optional(),
    tag: z.string().trim().toLowerCase().max(60).optional(),
    author: z.string().trim().toLowerCase().max(30).optional(),
    search: z.string().trim().min(2).max(100).optional(),
    featured: z.enum(["true", "false"]).optional(),
    trending: z.enum(["true", "false"]).optional(),
    sort: z.enum(["latest", "popular", "liked"]).default("latest"),
  }),
});

/** GET /articles/:slug — public article detail (published + public only). */
export const articleSlugSchema = z.object({
  params: z.object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(1)
      .max(180)
      .regex(/^[a-z0-9-]+$/),
  }),
});

/** GET /articles/suggest?q= — typeahead (posts + tags, tiny payload). */
export const suggestSchema = z.object({
  query: z.object({
    q: z.string().trim().min(1).max(60),
    limit: z.coerce.number().int().min(1).max(10).default(6),
  }),
});

export type ListArticlesQuery = z.infer<typeof listArticlesSchema>["query"];
