import { z } from "zod";

export const BlogDraftSchema = z.object({
  title: z.string().min(8).max(150),
  content: z.string().min(200).max(50000),
  excerpt: z.string().min(30).max(300),
  coverImagePrompt: z.string().optional(),
  readingTime: z.number().min(1).max(120),
  headings: z.array(z.string()).min(2),
  internalLinks: z.array(z.string()).default([]),
  codeExamples: z.boolean().default(false),
});

export type BlogDraft = z.infer<typeof BlogDraftSchema>;
