import type { BlogGenerationState } from "../state/blog-generation.state.js";
import { ResearchResultSchema, type ResearchResult } from "../schemas/research.schema.js";
import { RESEARCH_SYSTEM_PROMPT, researchUserPrompt } from "../prompts/research.prompt.js";
import { callAgent } from "./llm.utils.js";
import { logAgent } from "../services/logger.js";

export async function researchAgent(state: BlogGenerationState): Promise<Partial<BlogGenerationState>> {
  const start = Date.now();
  logAgent("research", "started", state.topic);

  try {
    const research = await callAgent<ResearchResult>(
      RESEARCH_SYSTEM_PROMPT,
      researchUserPrompt(state.topic, state.context),
      ResearchResultSchema,
      { maxTokens: 1200, label: "research" },
    );

    const elapsed = Date.now() - start;
    logAgent("research", "completed", state.topic, { duration: elapsed, concepts: research.keyConcepts.length });

    return {
      research,
      status: "planning",
      agentTimings: { ...state.agentTimings, research: elapsed },
    };
  } catch (err) {
    logAgent("research", "failed", state.topic, { error: (err as Error).message });
    return {
      status: "failed",
      errors: [...state.errors, `Research: ${(err as Error).message}`],
    };
  }
}
