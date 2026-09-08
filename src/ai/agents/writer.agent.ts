import type { BlogGenerationState } from "../state/blog-generation.state.js";
import { BlogDraftSchema, type BlogDraft } from "../schemas/blog.schema.js";
import { WRITER_SYSTEM_PROMPT, writerUserPrompt } from "../prompts/writer.prompt.js";
import { callAgent, validateContentQuality } from "./llm.utils.js";
import { logAgent, logWarn } from "../services/logger.js";

export async function writerAgent(state: BlogGenerationState): Promise<Partial<BlogGenerationState>> {
  if (!state.research || !state.plan) {
    return { status: "failed", errors: [...state.errors, "Writer: missing research or plan"] };
  }

  const start = Date.now();
  logAgent("writer", "started", state.topic, { revision: state.revisionCount });

  try {
    const draft = await callAgent<BlogDraft>(
      WRITER_SYSTEM_PROMPT,
      writerUserPrompt(
        state.topic,
        state.plan.selectedTitle,
        state.plan.outline,
        state.plan.difficulty,
        state.plan.targetAudience,
        state.plan.learningObjectives,
        state.research.notes,
      ),
      BlogDraftSchema,
      { maxTokens: 2000, label: "writer" },
    );

    // Quality check on content
    const quality = validateContentQuality(draft.content);
    if (!quality.valid) {
      logWarn("ai:writer", `Content quality issues: ${quality.issues.join("; ")}`, { topic: state.topic });
    }

    const elapsed = Date.now() - start;
    logAgent("writer", "completed", state.topic, {
      duration: elapsed,
      wordCount: draft.content.split(/\s+/).length,
      sections: draft.headings.length,
    });

    return {
      draft,
      status: "seo",
      agentTimings: { ...state.agentTimings, writer: elapsed },
    };
  } catch (err) {
    logAgent("writer", "failed", state.topic, { error: (err as Error).message });
    return {
      status: "failed",
      errors: [...state.errors, `Writer: ${(err as Error).message}`],
    };
  }
}
