import type { BlogGenerationState } from "../state/blog-generation.state.js";
import { SEOResultSchema, type SEOResult } from "../schemas/seo.schema.js";
import { SEO_SYSTEM_PROMPT, seoUserPrompt } from "../prompts/seo.prompt.js";
import { callAgent } from "./llm.utils.js";
import { logAgent } from "../services/logger.js";

export async function seoAgent(state: BlogGenerationState): Promise<Partial<BlogGenerationState>> {
  if (!state.draft) return { status: "failed", errors: [...state.errors, "SEO: no draft available"] };

  const start = Date.now();
  logAgent("seo", "started", state.topic);

  try {
    const seo = await callAgent<SEOResult>(
      SEO_SYSTEM_PROMPT,
      seoUserPrompt(state.draft.title, state.draft.content, state.topic),
      SEOResultSchema,
      { maxTokens: 500, label: "seo" },
    );

    const elapsed = Date.now() - start;
    logAgent("seo", "completed", state.topic, {
      duration: elapsed,
      slug: seo.slug,
      keywords: seo.keywords.length,
    });

    return {
      seo,
      status: "editing",
      agentTimings: { ...state.agentTimings, seo: elapsed },
    };
  } catch (err) {
    logAgent("seo", "failed", state.topic, { error: (err as Error).message });
    return {
      status: "failed",
      errors: [...state.errors, `SEO: ${(err as Error).message}`],
    };
  }
}
