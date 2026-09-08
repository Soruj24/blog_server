import { aiComplete, aiStream, estimateCost, getModelCostHint } from "../config/ai.js";
import { env } from "../config/env.js";
import { DeepAgentGraph } from "../ai/graph.js";
import { ApiError } from "../utils/ApiError.js";

const SYSTEM_EDITOR =
  "You are Inkwell's editorial assistant. Help authors craft clear, engaging blog posts. Be concise, professional, and never hallucinate facts. Use Markdown where helpful.";

/**
 * Call Ollama with automatic retry: first try with system message, then without
 * if the model returns empty. Gemma 4 returns empty for certain prompt+system combos
 * and for low num_predict values (non-deterministic).
 */
async function callWithRetry(
  prompt: string,
  system: string | undefined,
  maxTokens: number,
  label: string,
): Promise<string> {
  // For Ollama/Gemma: skip system message, use higher token floor
  if (env.AI_PROVIDER === "ollama") {
    // Gemma 4 needs higher num_predict to avoid empty responses
    const safeTokens = Math.max(maxTokens, 250);
    console.log(`[ai:service] ${label}: calling ollama (maxTokens=${safeTokens})`);

    // Up to 3 attempts with increasing token limits
    for (let attempt = 1; attempt <= 3; attempt++) {
      const tokens = safeTokens + (attempt - 1) * 150;
      const out = await aiComplete({ prompt, system: undefined, maxTokens: tokens });
      if (out && out.trim()) {
        console.log(`[ai:service] ${label}: success on attempt ${attempt} (${out.trim().length} chars)`);
        return out.trim();
      }
      console.warn(`[ai:service] ${label}: empty on attempt ${attempt} (num_predict=${tokens})`);
    }
    throw new ApiError(502, `AI returned empty response for ${label} after 3 attempts`);
  }

  // For other providers: try with system, retry without
  const out = await aiComplete({ prompt, system, maxTokens });
  if (out && out.trim()) return out.trim();

  if (system) {
    console.warn(`[ai:service] ${label}: empty response with system msg, retrying without`);
    const retry = await aiComplete({ prompt, system: undefined, maxTokens });
    if (retry && retry.trim()) return retry.trim();
  }

  throw new ApiError(502, `AI returned empty response for ${label}`);
}

function validateLength(text: string, field: string, min: number, max: number) {
  const len = text.trim().length;
  if (len < min) throw new ApiError(400, `${field} must be at least ${min} characters`);
  if (len > max) throw new ApiError(400, `${field} must be at most ${max} characters`);
}

function costMeta(prompt: string, output: string) {
  const c = estimateCost(prompt, output);
  return { ...c, hint: getModelCostHint(env.AI_MODEL || env.OLLAMA_MODEL) };
}

function mockResult(prompt: string, output: string) {
  return { result: output.trim(), ...costMeta(prompt, output), hint: "Demo · mock (set AI_PROVIDER for live)" } as const;
}

/** Extract fallback tags from content by picking frequent meaningful words. */
function extractFallbackTags(content: string): string[] {
  const stopwords = new Set([
    "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from",
    "is","are","was","were","be","been","being","have","has","had","do","does","did",
    "will","would","could","should","may","might","shall","can","need","dare","ought",
    "this","that","these","those","it","its","he","she","they","them","we","you","i",
    "my","your","his","her","our","their","me","him","us","what","which","who","whom",
    "how","when","where","why","all","each","every","both","few","more","most","other",
    "some","such","no","not","only","own","same","so","than","too","very","just",
    "because","as","until","while","about","between","through","during","before","after",
    "above","below","up","down","out","off","over","under","again","further","then",
    "once","here","there","also","into","using","use","used","make","like","time",
    "new","one","two","first","get","see","know","come","think","take","want","look",
    "if","than","many","much","well","back","even","still","way","going","go","does",
  ]);
  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

const PROMPTS = {
  title: (topic: string) => `Generate a compelling blog post title (max 70 chars) for: "${topic}". Return only the title.`,
  outline: (topic: string) => `Create a detailed outline with H2/H3 headings for an article about: "${topic}". Use Markdown headings.`,
  article: (topic: string, outline?: string) =>
    `Write a full 600-900 word article about "${topic}".${outline ? ` Follow this outline:\n${outline}` : ""}\nUse Markdown, engaging intro, 3-5 sections, conclusion.`,
  rewrite: (text: string, instruction?: string) =>
    `Rewrite the following content to be clearer and more engaging.${instruction ? ` Instruction: ${instruction}` : ""}\n\nContent:\n${text}`,
  grammar: (text: string) => `Improve grammar and clarity without changing meaning. Return only the corrected text:\n\n${text}`,
  summarize: (text: string) => `Summarize the following article in 3-5 bullet points and a 2-sentence TL;DR:\n\n${text}`,
  seoTitle: (title: string) => `Generate an SEO-optimized title (50-60 chars, include primary keyword) for: "${title}". Return only the title.`,
  seoDesc: (excerpt: string) => `Generate an SEO meta description (150-160 chars) for this excerpt: "${excerpt}". Return only the description.`,
  tags: (content: string) => `List 5-8 relevant tags for this blog post as comma-separated lowercase words (e.g. "react, typescript, web development"). Only the tag list, nothing else.\n\nPost:\n${content.slice(0, 2000)}\n\nTags:`,
  category: (content: string, categories: string[]) =>
    `Suggest the single best category from [${categories.join(", ")}] for this content:\n\n${content.slice(0, 1500)}\nReturn only the category slug.`,
  excerpt: (content: string) => `Write a 1-2 sentence blog excerpt (120-160 characters) that summarizes the key point of this article. Be specific and compelling. Do NOT use quotes or markdown.\n\nArticle:\n${content.slice(0, 2000)}\n\nExcerpt:`,
};

export const aiService = {
  async generateTitle(topic: string) {
    validateLength(topic, "Topic", 3, 200);
    if (env.AI_PROVIDER === "none") {
      const mock = `${topic.trim().replace(/\s+/g, " ").slice(0, 45)} — Essential Insights & Practical Guide`.slice(0, 70);
      return mockResult(PROMPTS.title(topic), mock);
    }
    const prompt = PROMPTS.title(topic);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 80, "title");
      return { result: out, ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] generateTitle failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI title generation failed: ${(err as Error).message}`);
    }
  },

  async generateOutline(topic: string) {
    validateLength(topic, "Topic", 3, 300);
    if (env.AI_PROVIDER === "none") {
      const mock = `## Introduction\nWhy ${topic} matters today\n## Core Concepts\nKey principles and terminology\n## Practical Guide\nStep-by-step implementation\n## Common Pitfalls\nWhat to avoid\n## Conclusion\nNext steps and takeaways`;
      return mockResult(PROMPTS.outline(topic), mock);
    }
    const prompt = PROMPTS.outline(topic);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 600, "outline");
      return { result: out, ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] generateOutline failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI outline generation failed: ${(err as Error).message}`);
    }
  },

  async generateArticle(topic: string, outline?: string) {
    validateLength(topic, "Topic", 3, 300);
    if (env.AI_PROVIDER === "none") {
      const mock = `# ${topic}\n\n## Introduction\n${topic} is reshaping how teams build and think. This draft explores the essentials.\n\n## Why it matters\nReaders need clarity, not hype. Focus on fundamentals and practical trade-offs.\n\n## Practical steps\n1. Start small and measure\n2. Document decisions\n3. Iterate with feedback\n\n## Conclusion\nA concise path forward for ${topic}. (Demo draft — configure AI_PROVIDER for live Gemma generation)`;
      return mockResult(PROMPTS.article(topic, outline), mock);
    }
    if (env.AI_PROVIDER === "ollama") {
      const graph = new DeepAgentGraph()
        .addNode("outline", async (s) => {
          const o = outline || (await aiComplete({ prompt: PROMPTS.outline(s.topic), system: SYSTEM_EDITOR, maxTokens: 400 })) || "";
          return { outline: o };
        })
        .addNode("draft", async (s) => {
          const d = (await aiComplete({ prompt: PROMPTS.article(s.topic, s.outline), system: SYSTEM_EDITOR, maxTokens: 1000 })) || "";
          return { draft: d, final: d };
        })
        .addNode("critique", async (s) => {
          const c =
            (await aiComplete({
              prompt: `Critique this draft for clarity, flow, and engagement (2-3 sentences):\n\n${s.draft}`,
              system: SYSTEM_EDITOR,
              maxTokens: 200,
            })) || "";
          return { critique: c };
        })
        .addNode("refine", async (s) => {
          const f =
            (await aiComplete({
              prompt: `Refine the article based on critique: "${s.critique}"\n\nDraft:\n${s.draft}`,
              system: SYSTEM_EDITOR,
              maxTokens: 1000,
            })) || s.draft;
          return { final: f || "" };
        })
        .addEdge("outline", "draft")
        .addEdge("draft", "critique")
        .addEdge("critique", "refine");
      try {
        const state = await graph.run("outline", { topic, outline, final: "", tokens: 0 });
        const final = state.final.trim();
        if (!final) throw new ApiError(502, "Deep agent produced empty article");
        return { result: final, ...costMeta(topic + (outline || ""), final) };
      } catch (err) {
        console.error(`[ai:service] generateArticle (deep agent) failed: ${(err as Error).message}`);
        throw err instanceof ApiError ? err : new ApiError(502, `Deep agent article generation failed: ${(err as Error).message}`);
      }
    }
    const prompt = PROMPTS.article(topic, outline);
    try {
      const out = await aiComplete({ prompt, system: SYSTEM_EDITOR, maxTokens: 1200 });
      if (!out) throw new ApiError(502, "AI returned empty response for article");
      return { result: out.trim(), ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] generateArticle failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI article generation failed: ${(err as Error).message}`);
    }
  },

  async rewrite(content: string, instruction?: string) {
    validateLength(content, "Content", 20, 10000);
    if (env.AI_PROVIDER === "none") {
      const mock = instruction ? `${content.slice(0, 400)} [Rewritten: ${instruction}]` : content.slice(0, 600) + " (Rewritten for clarity — demo)";
      return mockResult(PROMPTS.rewrite(content, instruction), mock);
    }
    const prompt = PROMPTS.rewrite(content, instruction);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 800, "rewrite");
      return { result: out, ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] rewrite failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI rewrite failed: ${(err as Error).message}`);
    }
  },

  async improveGrammar(content: string) {
    validateLength(content, "Content", 10, 10000);
    if (env.AI_PROVIDER === "none") {
      return mockResult(PROMPTS.grammar(content), content.trim() + " [Grammar checked — demo]");
    }
    const prompt = PROMPTS.grammar(content);
    try {
      const out = await callWithRetry(prompt, "You are a grammar expert. Correct only grammar, do not change style.", 800, "grammar");
      return { result: out, ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] improveGrammar failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI grammar fix failed: ${(err as Error).message}`);
    }
  },

  async summarize(content: string) {
    validateLength(content, "Content", 50, 15000);
    if (env.AI_PROVIDER === "none") {
      const mock = `• Key point about ${content.slice(0, 30)}...\n• Practical takeaway\n• Why it matters\n\nTL;DR: Concise summary of the article's core idea and next step. (Demo)`;
      return mockResult(PROMPTS.summarize(content), mock);
    }
    const prompt = PROMPTS.summarize(content);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 400, "summarize");
      return { result: out, ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] summarize failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI summarize failed: ${(err as Error).message}`);
    }
  },

  async seoTitle(title: string) {
    validateLength(title, "Title", 5, 200);
    if (env.AI_PROVIDER === "none") {
      return mockResult(PROMPTS.seoTitle(title), title.trim().slice(0, 55) + " | Inkwell");
    }
    const prompt = PROMPTS.seoTitle(title);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 80, "seo-title");
      return { result: out.slice(0, 70), ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] seoTitle failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI SEO title failed: ${(err as Error).message}`);
    }
  },

  async seoDescription(excerpt: string) {
    validateLength(excerpt, "Excerpt", 10, 1000);
    if (env.AI_PROVIDER === "none") {
      return mockResult(PROMPTS.seoDesc(excerpt), excerpt.trim().slice(0, 155));
    }
    const prompt = PROMPTS.seoDesc(excerpt);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 100, "seo-description");
      return { result: out.slice(0, 160), ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] seoDescription failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI SEO description failed: ${(err as Error).message}`);
    }
  },

  async generateTags(content: string) {
    validateLength(content, "Content", 20, 10000);
    if (env.AI_PROVIDER === "none") {
      const mock = "ai, writing, productivity, nextjs, tutorial";
      return { result: mock, tags: mock.split(",").map((t) => t.trim()), ...costMeta(PROMPTS.tags(content), mock) };
    }
    const prompt = PROMPTS.tags(content);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 150, "tags");
      const cleaned = out.replace(/^Tags:\s*/i, "").trim();
      const tags = cleaned
        .split(",")
        .map((t) => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, ""))
        .filter((t) => t.length > 1)
        .slice(0, 8);
      if (tags.length === 0) throw new Error("No valid tags parsed");
      return { result: tags.join(", "), tags, ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] generateTags failed: ${(err as Error).message}`);
      // Graceful fallback: extract high-frequency words from content
      const fallback = extractFallbackTags(content);
      console.warn(`[ai:service] tags: using content-derived fallback [${fallback.join(", ")}]`);
      return { result: fallback.join(", "), tags: fallback, ...costMeta(prompt, ""), hint: "Fallback (AI unavailable)" };
    }
  },

  async suggestCategory(content: string) {
    validateLength(content, "Content", 20, 10000);
    const { Category } = await import("../models/Category.js");
    const cats = await Category.find({ isActive: true }).select("slug").lean();
    const slugs = cats.map((c) => c.slug);
    if (slugs.length === 0) throw new ApiError(404, "No categories available");
    if (env.AI_PROVIDER === "none") {
      return mockResult(PROMPTS.category(content, slugs), slugs[0]!);
    }
    const prompt = PROMPTS.category(content, slugs);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 30, "category");
      const slug = out.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
      const match = slugs.includes(slug) ? slug : slugs[0]!;
      return { result: match, ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] suggestCategory failed: ${(err as Error).message}`);
      throw err instanceof ApiError ? err : new ApiError(502, `AI category suggestion failed: ${(err as Error).message}`);
    }
  },

  async generateExcerpt(content: string) {
    validateLength(content, "Content", 50, 15000);
    if (env.AI_PROVIDER === "none") {
      const mock = content.trim().slice(0, 145) + "...";
      return mockResult(PROMPTS.excerpt(content), mock);
    }
    const prompt = PROMPTS.excerpt(content);
    try {
      const out = await callWithRetry(prompt, SYSTEM_EDITOR, 150, "excerpt");
      // Fallback: if AI returns too short or garbage, generate from content
      const cleaned = out.replace(/^Excerpt:\s*/i, "").trim();
      if (cleaned.length < 20) {
        const fallback = content.trim().slice(0, 155).replace(/\s+\S*$/, "") + "...";
        console.warn(`[ai:service] excerpt too short (${cleaned.length} chars), using fallback`);
        return { result: fallback, ...costMeta(prompt, fallback) };
      }
      return { result: cleaned.slice(0, 300), ...costMeta(prompt, out) };
    } catch (err) {
      console.error(`[ai:service] generateExcerpt failed: ${(err as Error).message}`);
      // Graceful fallback: derive excerpt from content instead of failing
      const fallback = content.trim().slice(0, 155).replace(/\s+\S*$/, "") + "...";
      console.warn(`[ai:service] excerpt: using content-derived fallback (${fallback.length} chars)`);
      return { result: fallback, ...costMeta(prompt, fallback), hint: "Fallback (AI unavailable)" };
    }
  },

  streamArticle(topic: string, outline?: string) {
    const prompt = PROMPTS.article(topic, outline);
    return aiStream({ prompt, system: SYSTEM_EDITOR, maxTokens: 1200 });
  },
};
