import { z } from "zod";

export const generateBlogSchema = z.object({
  body: z.object({
    topic: z.string().trim().min(5).max(300),
    context: z.string().trim().max(1000).optional(),
    articleType: z
      .enum([
        "tutorial",
        "guide",
        "deep-dive",
        "comparison",
        "best-practices",
        "architecture",
        "case-study",
        "career",
        "opinion",
      ])
      .optional(),
    saveToDb: z.boolean().default(true),
  }).strict(),
});

export const generateBlogsSchema = z.object({
  body: z.object({
    topics: z.array(z.string().trim().min(5).max(300)).min(1).max(50),
    count: z.number().min(1).max(50).optional(),
    concurrency: z.number().min(1).max(5).optional(),
  }).strict(),
});

export const previewGenerationSchema = z.object({
  body: z.object({
    topic: z.string().trim().min(5).max(300),
  }).strict(),
});
