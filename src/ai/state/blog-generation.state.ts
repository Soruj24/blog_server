import type { ResearchResult } from "../schemas/research.schema.js";
import type { ContentPlan } from "../schemas/plan.schema.js";
import type { BlogDraft } from "../schemas/blog.schema.js";
import type { SEOResult } from "../schemas/seo.schema.js";
import type { EditorialReview, QualityReport } from "../schemas/review.schema.js";

/**
 * Strongly-typed state for the blog generation LangGraph workflow.
 * Every agent reads from and writes to this state.
 * No global mutable state — state is passed through the graph.
 */
export interface BlogGenerationState {
  // Input
  topic: string;
  context?: string;
  requestedArticleType?: string;

  // Research agent output
  research?: ResearchResult;

  // Planner agent output
  plan?: ContentPlan;

  // Writer agent output
  draft?: BlogDraft;

  // SEO agent output
  seo?: SEOResult;

  // Editor agent output
  editorialReview?: EditorialReview;

  // QA agent output
  qualityReport?: QualityReport;

  // Workflow metadata
  retryCount: number;
  maxRetries: number;
  revisionCount: number;
  maxRevisions: number;
  status: "pending" | "researching" | "planning" | "writing" | "seo" | "editing" | "quality_check" | "revision" | "passed" | "failed";
  errors: string[];
  startedAt: string;
  completedAt?: string;
  agentTimings: Record<string, number>;
}

export function createInitialState(topic: string, context?: string, requestedArticleType?: string): BlogGenerationState {
  return {
    topic,
    context,
    requestedArticleType,
    retryCount: 0,
    maxRetries: 2,
    revisionCount: 0,
    maxRevisions: 2,
    status: "pending",
    errors: [],
    startedAt: new Date().toISOString(),
    agentTimings: {},
  };
}
