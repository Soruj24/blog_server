import type { BlogGenerationState } from "../state/blog-generation.state.js";
import { EditorialReviewSchema, type EditorialReview } from "../schemas/review.schema.js";
import { EDITOR_SYSTEM_PROMPT, editorUserPrompt } from "../prompts/editor.prompt.js";
import { callAgent } from "./llm.utils.js";
import { logAgent } from "../services/logger.js";

export async function editorAgent(state: BlogGenerationState): Promise<Partial<BlogGenerationState>> {
  if (!state.draft) return { status: "failed", errors: [...state.errors, "Editor: no draft available"] };

  const start = Date.now();
  logAgent("editor", "started", state.topic);

  try {
    const editorialReview = await callAgent<EditorialReview>(
      EDITOR_SYSTEM_PROMPT,
      editorUserPrompt(state.draft.title, state.draft.content, state.topic),
      EditorialReviewSchema,
      { maxTokens: 1000, label: "editor" },
    );

    const elapsed = Date.now() - start;
    logAgent("editor", "completed", state.topic, {
      duration: elapsed,
      verdict: editorialReview.verdict,
      score: editorialReview.score,
    });

    return {
      editorialReview,
      status: "quality_check",
      agentTimings: { ...state.agentTimings, editor: elapsed },
    };
  } catch (err) {
    logAgent("editor", "failed", state.topic, { error: (err as Error).message });
    return {
      status: "failed",
      errors: [...state.errors, `Editor: ${(err as Error).message}`],
    };
  }
}
