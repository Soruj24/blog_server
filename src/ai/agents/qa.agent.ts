import type { BlogGenerationState } from "../state/blog-generation.state.js";
import { QualityReportSchema, type QualityReport } from "../schemas/review.schema.js";
import { QA_SYSTEM_PROMPT, qaUserPrompt } from "../prompts/qa.prompt.js";
import { callAgent } from "./llm.utils.js";
import { logAgent } from "../services/logger.js";

export async function qaAgent(state: BlogGenerationState): Promise<Partial<BlogGenerationState>> {
  if (!state.draft || !state.seo) {
    return { status: "failed", errors: [...state.errors, "QA: missing draft or SEO data"] };
  }

  const start = Date.now();
  logAgent("qa", "started", state.topic);

  try {
    const qualityReport = await callAgent<QualityReport>(
      QA_SYSTEM_PROMPT,
      qaUserPrompt(
        state.draft.title,
        state.draft.content,
        state.seo.seoTitle,
        state.seo.metaDescription,
        state.seo.slug,
      ),
      QualityReportSchema,
      { maxTokens: 800, label: "qa" },
    );

    const elapsed = Date.now() - start;
    logAgent("qa", "completed", state.topic, {
      duration: elapsed,
      passed: qualityReport.passed,
      score: qualityReport.score,
    });

    return {
      qualityReport,
      agentTimings: { ...state.agentTimings, qa: elapsed },
    };
  } catch (err) {
    logAgent("qa", "failed", state.topic, { error: (err as Error).message });
    return {
      status: "failed",
      errors: [...state.errors, `QA: ${(err as Error).message}`],
    };
  }
}
