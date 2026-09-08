import { z } from "zod";

const topic = z.string().trim().min(3).max(300);
const content = z.string().trim().min(10).max(15000);
const longContent = z.string().trim().min(20).max(15000);

export const titleSchema = z.object({ body: z.object({ topic }).strict() });
export const outlineSchema = z.object({ body: z.object({ topic, content: z.string().trim().max(2000).optional() }).strict() });
export const articleSchema = z.object({
  body: z
    .object({
      topic: z.string().trim().min(3).max(300),
      outline: z.string().trim().max(5000).optional(),
      stream: z.boolean().optional(),
    })
    .strict(),
});
export const rewriteSchema = z.object({
  body: z.object({ content: longContent, instruction: z.string().trim().max(500).optional() }).strict(),
});
export const grammarSchema = z.object({ body: z.object({ content }).strict() });
export const summarizeSchema = z.object({ body: z.object({ content: z.string().trim().min(50).max(15000) }).strict() });
export const seoTitleSchema = z.object({ body: z.object({ title: z.string().trim().min(5).max(200) }).strict() });
export const seoDescSchema = z.object({ body: z.object({ excerpt: z.string().trim().min(10).max(1000) }).strict() });
export const tagsSchema = z.object({ body: z.object({ content: longContent }).strict() });
export const categorySchema = z.object({ body: z.object({ content: longContent }).strict() });
export const excerptSchema = z.object({ body: z.object({ content: z.string().trim().min(50).max(15000) }).strict() });
