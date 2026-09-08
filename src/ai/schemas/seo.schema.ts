import { z } from "zod";

export const SEOResultSchema = z.object({
  seoTitle: z.string().min(30).max(70),
  metaDescription: z.string().min(70).max(160),
  slug: z
    .string()
    .min(5)
    .max(180)
    .regex(/^[a-z0-9-]+$/, "Invalid slug format"),
  keywords: z.array(z.string().min(2).max(30)).min(3).max(10),
  excerpt: z.string().min(50).max(200),
  ogDescription: z.string().min(50).max(200),
  focusKeyword: z.string().min(2).max(50),
});

export type SEOResult = z.infer<typeof SEOResultSchema>;
