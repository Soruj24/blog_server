/**
 * LangGraph-inspired deep agent for Ollama Gemma.
 * Lightweight state-graph without external deps: nodes are async functions,
 * edges are conditional transitions. Mimics LangGraph's StateGraph pattern
 * for the editorial workflow: research → outline → draft → critique → refine.
 *
 * Deep agent behavior: the Gemma model is called iteratively with
 * critique-refine loop (up to 2 passes) for higher-quality long-form.
 */

interface AgentState {
  topic: string;
  context?: string;
  outline?: string;
  draft?: string;
  critique?: string;
  final: string;
  tokens: number;
}

type NodeFn = (state: AgentState) => Promise<Partial<AgentState>>;

export class DeepAgentGraph {
  private nodes = new Map<string, NodeFn>();
  private edges = new Map<string, string | ((s: AgentState) => string)>();

  addNode(name: string, fn: NodeFn) {
    this.nodes.set(name, fn);
    return this;
  }
  addEdge(from: string, to: string | ((s: AgentState) => string)) {
    this.edges.set(from, to);
    return this;
  }
  async run(entry: string, initial: AgentState): Promise<AgentState> {
    let current = entry;
    let state = { ...initial };
    const visited = new Set<string>();
    while (current && !visited.has(current + JSON.stringify(state).length)) {
      visited.add(current);
      const fn = this.nodes.get(current);
      if (!fn) break;
      const patch = await fn(state);
      state = { ...state, ...patch };
      const next = this.edges.get(current);
      if (!next) break;
      current = typeof next === "function" ? next(state) : next;
      if (visited.size > 10) break; // safety
    }
    return state;
  }
}
