import { env } from "../../config/env.js";
import { BlogGenerationGraph } from "../graphs/blog-generation.graph.js";
import { createInitialState, type BlogGenerationState } from "../state/blog-generation.state.js";
import { researchAgent } from "../agents/research.agent.js";
import { plannerAgent } from "../agents/planner.agent.js";
import { writerAgent } from "../agents/writer.agent.js";
import { seoAgent } from "../agents/seo.agent.js";
import { editorAgent } from "../agents/editor.agent.js";
import { qaAgent } from "../agents/qa.agent.js";
import { deepAgentTools } from "../tools/index.js";
import { logGeneration, logGraph, logError, logWarn } from "./logger.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * Main blog generation service.
 * Orchestrates the multi-agent pipeline: research → plan → write → SEO → edit → QA.
 * Supports single and batch generation with concurrency control.
 */

interface GenerateBlogInput {
  topic: string;
  context?: string;
  articleType?: string;
  authorUsername?: string;
  saveToDb?: boolean;
}

interface GenerateBlogResult {
  state: BlogGenerationState;
  saved?: { postId: string; slug: string };
}

interface GenerateBlogsInput {
  topics: string[];
  count?: number;
  authorUsername?: string;
  concurrency?: number;
}

// Build the LangGraph workflow
function buildGraph(): BlogGenerationGraph {
  return new BlogGenerationGraph()
    .setEntry("research")
    .addNode("research", researchAgent)
    .addNode("planner", plannerAgent)
    .addNode("writer", writerAgent)
    .addNode("seo", seoAgent)
    .addNode("editor", editorAgent)
    .addNode("qa", qaAgent)
    .addEdge("research", "planner")
    .addEdge("planner", "writer")
    .addEdge("writer", "seo")
    .addEdge("seo", "editor")
    .addEdge("editor", "qa")
    .addEdge("qa", (state) => {
      // Decision: PASS → save, NEEDS_REVISION → retry writer
      if (state.qualityReport?.passed) {
        return "save";
      }
      if (state.revisionCount < state.maxRevisions) {
        logGraph("revision needed", {
          topic: state.topic,
          revision: state.revisionCount + 1,
          score: state.qualityReport?.score,
        });
        return "writer"; // Loop back to writer
      }
      logWarn("ai:graph", `Max revisions reached for "${state.topic}"`, { score: state.qualityReport?.score });
      return "save"; // Save anyway after max revisions
    })
    .addNode("save", async (state) => {
      if (!state.draft || !state.seo) {
        return { status: "failed" as const, errors: [...state.errors, "Save: missing draft or SEO"] };
      }
      return { status: "passed" as const, completedAt: new Date().toISOString() };
    });
}

// Single blog generation
export async function generateBlog(input: GenerateBlogInput): Promise<GenerateBlogResult> {
  const { topic, context, articleType, authorUsername, saveToDb = true } = input;

  logGeneration("started", { topic, articleType, saveToDb });

  if (env.AI_PROVIDER === "none") {
    throw new ApiError(503, "AI provider is set to 'none'. Configure AI_PROVIDER for blog generation.");
  }

  const graph = buildGraph();
  let state = createInitialState(topic, context, articleType);

  // Run the graph
  const startTime = Date.now();
  state = await graph.run(state);
  const totalTime = Date.now() - startTime;

  logGeneration("pipeline completed", {
    topic,
    status: state.status,
    totalTime,
    agentTimings: state.agentTimings,
    errors: state.errors,
  });

  // Handle revision loop increment
  if (state.status === "passed" && state.qualityReport && !state.qualityReport.passed) {
    state.revisionCount++;
  }

  // Save to database if requested and pipeline passed
  let saved: GenerateBlogResult["saved"];
  if (saveToDb && state.status === "passed" && state.draft && state.seo) {
    try {
      // Duplicate check
      const duplicateCheck = await deepAgentTools.checkDuplicate.execute({
        title: state.draft.title,
        content: state.draft.content,
        category: state.plan?.articleType,
        tags: state.seo.keywords,
      });

      if (duplicateCheck.isDuplicate) {
        logWarn("ai:generation", `Duplicate detected for "${topic}"`, {
          confidence: duplicateCheck.confidence,
          similar: duplicateCheck.similarTitles,
        });
        // Still save but flag it — human review can decide
      }

      const result = await deepAgentTools.saveDraft.execute({
        title: state.draft.title,
        excerpt: state.draft.excerpt,
        content: state.draft.content,
        authorUsername: authorUsername ?? "maya_writes",
        categoryName: state.plan?.articleType,
        tagNames: state.seo.keywords.slice(0, 5),
        seoTitle: state.seo.seoTitle,
        seoDescription: state.seo.metaDescription,
        slug: state.seo.slug,
        coverImage: state.draft.coverImagePrompt,
      });

      saved = { postId: result.postId, slug: result.slug };
      logGeneration("saved to database", { topic, postId: result.postId, slug: result.slug });
    } catch (err) {
      logError("ai:generation", `Database save failed for "${topic}"`, { error: (err as Error).message });
      state.errors.push(`DB save: ${(err as Error).message}`);
    }
  }

  return { state, saved };
}

// Batch blog generation
export async function generateBlogs(input: GenerateBlogsInput): Promise<GenerateBlogResult[]> {
  const { topics, authorUsername, concurrency = env.AI_GEN_CONCURRENCY } = input;
  const count = input.count ?? topics.length;
  const selectedTopics = topics.slice(0, count);

  logGeneration("batch started", { count: selectedTopics.length, concurrency });

  const results: GenerateBlogResult[] = [];
  const queue = [...selectedTopics];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const topic = queue.shift()!;
      try {
        const result = await generateBlog({ topic, authorUsername, saveToDb: true });
        results.push(result);
      } catch (err) {
        logError("ai:batch", `Failed: "${topic}"`, { error: (err as Error).message });
        results.push({
          state: {
            ...createInitialState(topic),
            status: "failed",
            errors: [(err as Error).message],
          },
        });
      }
    }
  }

  // Run with concurrency limit
  const workers = Array.from({ length: Math.min(concurrency, selectedTopics.length) }, () => processNext());
  await Promise.all(workers);

  logGeneration("batch completed", {
    total: selectedTopics.length,
    succeeded: results.filter((r) => r.state.status === "passed").length,
    failed: results.filter((r) => r.state.status === "failed").length,
  });

  return results;
}

// Quick generation without DB save (for preview/testing)
export async function previewGeneration(topic: string): Promise<BlogGenerationState> {
  const { state } = await generateBlog({ topic, saveToDb: false });
  return state;
}
