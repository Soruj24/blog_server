import type { BlogGenerationState } from "../state/blog-generation.state.js";
import { ContentPlanSchema, type ContentPlan } from "../schemas/plan.schema.js";
import { PLANNER_SYSTEM_PROMPT, plannerUserPrompt } from "../prompts/planner.prompt.js";
import { callAgent } from "./llm.utils.js";
import { logAgent } from "../services/logger.js";

export async function plannerAgent(state: BlogGenerationState): Promise<Partial<BlogGenerationState>> {
  if (!state.research) return { status: "failed", errors: [...state.errors, "Planner: no research data"] };

  const start = Date.now();
  logAgent("planner", "started", state.topic);

  try {
    const plan = await callAgent<ContentPlan>(
      PLANNER_SYSTEM_PROMPT,
      plannerUserPrompt(
        state.topic,
        state.research.keyConcepts,
        state.research.scope,
        state.research.targetAudience,
        state.research.technicalDepth,
        state.research.suggestedAngles,
      ),
      ContentPlanSchema,
      { maxTokens: 1500, label: "planner" },
    );

    // Override article type if requested
    if (state.requestedArticleType) {
      const validTypes = ContentPlanSchema.shape.articleType.options;
      if (validTypes.includes(state.requestedArticleType as any)) {
        plan.articleType = state.requestedArticleType as ContentPlan["articleType"];
      }
    }

    const elapsed = Date.now() - start;
    logAgent("planner", "completed", state.topic, {
      duration: elapsed,
      title: plan.selectedTitle,
      sections: plan.outline.length,
    });

    return {
      plan,
      status: "writing",
      agentTimings: { ...state.agentTimings, planner: elapsed },
    };
  } catch (err) {
    logAgent("planner", "failed", state.topic, { error: (err as Error).message });
    return {
      status: "failed",
      errors: [...state.errors, `Planner: ${(err as Error).message}`],
    };
  }
}
