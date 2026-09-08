import type { BlogGenerationState } from "../state/blog-generation.state.js";

type NodeFn = (state: BlogGenerationState) => Promise<Partial<BlogGenerationState>>;
type EdgeCondition = (state: BlogGenerationState) => string;

/**
 * LangGraph-style state graph for the blog generation workflow.
 * Nodes are async functions that return partial state updates.
 * Edges are either static target names or conditional functions.
 *
 * Safety: max 30 iterations to prevent infinite loops.
 */
export class BlogGenerationGraph {
  private nodes = new Map<string, NodeFn>();
  private edges = new Map<string, string | EdgeCondition>();
  private entryNode: string | null = null;

  addNode(name: string, fn: NodeFn): this {
    this.nodes.set(name, fn);
    return this;
  }

  setEntry(name: string): this {
    this.entryNode = name;
    return this;
  }

  addEdge(from: string, to: string | EdgeCondition): this {
    this.edges.set(from, to);
    return this;
  }

  async run(initial: BlogGenerationState): Promise<BlogGenerationState> {
    if (!this.entryNode) throw new Error("No entry node set");

    let current = this.entryNode;
    let state = { ...initial };
    const visited: string[] = [];
    const MAX_ITERATIONS = 30;

    while (current) {
      if (visited.length >= MAX_ITERATIONS) {
        state.errors.push(`Graph exceeded ${MAX_ITERATIONS} iterations — aborting`);
        state.status = "failed";
        break;
      }

      const fn = this.nodes.get(current);
      if (!fn) {
        state.errors.push(`Node "${current}" not found in graph`);
        state.status = "failed";
        break;
      }

      visited.push(current);

      try {
        const patch = await fn(state);
        state = { ...state, ...patch };
      } catch (err) {
        state.errors.push(`Node "${current}" failed: ${(err as Error).message}`);
        state.status = "failed";
        break;
      }

      const next = this.edges.get(current);
      if (!next) break;

      current = typeof next === "function" ? next(state) : next;
    }

    return state;
  }
}
