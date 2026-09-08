import { z } from "zod";

/**
 * Tool registry for the deep agent.
 * Each tool has typed input/output, validation, and error handling.
 * The deep agent can only use these controlled tools — no arbitrary fs/shell.
 */

export interface Tool<I, O> {
  name: string;
  description: string;
  inputSchema: z.ZodType<I>;
  execute: (input: I) => Promise<O>;
}

function createTool<I, O>(config: Tool<I, O>): Tool<I, O> {
  return config;
}

// --- Tool implementations ---

import { ContentPlanSchema, type ContentPlan } from "../schemas/plan.schema.js";
import { SEOResultSchema, type SEOResult } from "../schemas/seo.schema.js";
import { Post } from "../../models/Post.js";
import { Category } from "../../models/Category.js";
import { Tag } from "../../models/Tag.js";
import { Profile } from "../../models/Profile.js";
import type { BlogDraft } from "../schemas/blog.schema.js";

export const generateOutlineTool = createTool({
  name: "generateOutline",
  description: "Generate a structured article outline from a content plan",
  inputSchema: z.object({
    title: z.string(),
    articleType: z.string(),
    targetAudience: z.string(),
    keyPoints: z.array(z.string()),
  }),
  execute: async (input) => {
    // Outline generation is handled by the planner agent
    // This tool just validates and formats the plan
    return {
      outline: input.keyPoints.map((kp, i) => ({
        heading: kp,
        level: i === 0 ? "h2" as const : "h2" as const,
        keyPoints: [kp],
        estimatedWords: 200,
      })),
      wordCount: input.keyPoints.length * 200,
    };
  },
});

export const generateArticleTool = createTool({
  name: "generateArticle",
  description: "Generate complete article content from plan and outline",
  inputSchema: z.object({
    title: z.string(),
    outline: z.array(z.object({ heading: z.string(), keyPoints: z.array(z.string()) })),
    topic: z.string(),
  }),
  execute: async (input) => {
    // Article generation is handled by the writer agent
    // This tool serves as a controlled interface for the deep agent
    return {
      generated: true,
      sections: input.outline.length,
      title: input.title,
    };
  },
});

export const generateSEOTool = createTool({
  name: "generateSEO",
  description: "Generate SEO metadata for a blog article",
  inputSchema: z.object({
    title: z.string(),
    content: z.string(),
    topic: z.string(),
  }),
  execute: async (input) => {
    // SEO generation is handled by the SEO agent
    return {
      generated: true,
      title: input.title.slice(0, 60),
    };
  },
});

export const checkDuplicateTool = createTool({
  name: "checkDuplicate",
  description: "Check if a similar article already exists in the database",
  inputSchema: z.object({
    title: z.string(),
    content: z.string(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
  execute: async (input) => {
    // Check title similarity via text search
    const titleWords = input.title
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .join(" ");

    if (!titleWords.trim()) {
      return { isDuplicate: false, confidence: 0, similarTitles: [] };
    }

    const similar = await Post.find(
      { $text: { $search: titleWords } },
      { score: { $meta: "textScore" }, title: 1, slug: 1 },
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(5)
      .lean();

    const highMatch = similar.find((s) => (s as any).score > 3);
    return {
      isDuplicate: !!highMatch,
      confidence: highMatch ? (highMatch as any).score / 10 : 0,
      similarTitles: similar.map((s) => ({ title: s.title, slug: s.slug })),
    };
  },
});

export const saveDraftTool = createTool({
  name: "saveDraft",
  description: "Save a generated article as a draft in MongoDB",
  inputSchema: z.object({
    title: z.string(),
    excerpt: z.string(),
    content: z.string(),
    authorUsername: z.string(),
    categoryName: z.string().optional(),
    tagNames: z.array(z.string()).optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    slug: z.string().optional(),
    coverImage: z.string().optional(),
  }),
  execute: async (input) => {
    const profile = await Profile.findOne({ username: input.authorUsername }).select("user");
    if (!profile) throw new Error(`Author not found: ${input.authorUsername}`);

    let categoryId: string | null = null;
    if (input.categoryName) {
      const cat = await Category.findOne({ slug: input.categoryName }).select("_id");
      categoryId = cat?._id?.toString() ?? null;
    }

    const tagIds: string[] = [];
    if (input.tagNames?.length) {
      const tags = await Tag.find({ slug: { $in: input.tagNames } }).select("_id");
      tagIds.push(...tags.map((t) => t._id.toString()));
    }

    const post = await Post.create({
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      author: profile.user,
      category: categoryId,
      tags: tagIds,
      status: "draft",
      visibility: "public",
      coverImage: input.coverImage || null,
      seoTitle: input.seoTitle || null,
      seoDescription: input.seoDescription || null,
    });

    return {
      saved: true,
      postId: post._id.toString(),
      slug: post.slug,
      status: post.status,
    };
  },
});

export const updateDraftTool = createTool({
  name: "updateDraft",
  description: "Update an existing draft with revised content",
  inputSchema: z.object({
    postId: z.string(),
    title: z.string().optional(),
    excerpt: z.string().optional(),
    content: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
  }),
  execute: async (input) => {
    const post = await Post.findById(input.postId);
    if (!post) throw new Error(`Post not found: ${input.postId}`);

    if (input.title) post.title = input.title;
    if (input.excerpt) post.excerpt = input.excerpt;
    if (input.content) post.content = input.content;
    if (input.seoTitle) post.seoTitle = input.seoTitle;
    if (input.seoDescription) post.seoDescription = input.seoDescription;

    await post.save();

    return {
      updated: true,
      postId: post._id.toString(),
      slug: post.slug,
    };
  },
});

export const analyzeContentTool = createTool({
  name: "analyzeContent",
  description: "Analyze article content for quality signals",
  inputSchema: z.object({
    content: z.string(),
    title: z.string(),
  }),
  execute: async (input) => {
    const words = input.content.split(/\s+/).filter(Boolean);
    const sentences = input.content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    const paragraphs = input.content.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const headings = input.content.match(/^#{1,3}\s+.+$/gm) || [];
    const codeBlocks = (input.content.match(/```/g) || []).length / 2;
    const links = (input.content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []).length;
    const lists = (input.content.match(/^[\s]*[-*]\s/gm) || []).length;

    // Repetition check
    const uniqueSentences = new Set(sentences.map((s) => s.trim().toLowerCase()));
    const repetitionRatio = sentences.length > 0 ? 1 - uniqueSentences.size / sentences.length : 0;

    return {
      wordCount: words.length,
      sentenceCount: sentences.length,
      paragraphCount: paragraphs.length,
      headingCount: headings.length,
      codeBlockCount: Math.floor(codeBlocks),
      linkCount: links,
      listCount: lists,
      avgWordsPerSentence: sentences.length > 0 ? Math.round(words.length / sentences.length) : 0,
      repetitionRatio: Math.round(repetitionRatio * 100) / 100,
      readingTimeMinutes: Math.max(1, Math.ceil(words.length / 200)),
    };
  },
});

export const deepAgentTools = {
  generateOutline: generateOutlineTool,
  generateArticle: generateArticleTool,
  generateSEO: generateSEOTool,
  checkDuplicate: checkDuplicateTool,
  saveDraft: saveDraftTool,
  updateDraft: updateDraftTool,
  analyzeContent: analyzeContentTool,
};
