import { env } from "./env.js";

export type AiProvider = "openrouter" | "groq" | "ollama" | "none";

interface AiCompletionInput {
  prompt: string;
  system?: string;
  maxTokens?: number;
  stream?: boolean;
}

export interface AiStreamChunk {
  text: string;
  done: boolean;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
}

export function estimateCost(input: string, output: string): { inputTokens: number; outputTokens: number; total: number } {
  const inputTokens = estimateTokens(input);
  const outputTokens = estimateTokens(output);
  return { inputTokens, outputTokens, total: inputTokens + outputTokens };
}

// Pricing hints (per 1k tokens, approximate)
const MODEL_PRICING: Record<string, number> = {
  "gemma3:4b": 0,
  "gemma4": 0,
  "gemma4:latest": 0,
  "gemma2:9b": 0,
  "llama-3.1-8b-instant": 0.05,
  "meta-llama/llama-3.1-8b-instruct:free": 0,
};

export function getModelCostHint(model: string): string {
  const cost = MODEL_PRICING[model] ?? 0;
  return cost === 0 ? "Local · free" : `~$${cost.toFixed(3)}/1k tokens`;
}

/**
 * Configurable AI layer — OpenRouter/Groq (OpenAI-compatible) + Ollama deep agent.
 * No vendor SDK; plain fetch so swapping providers never touches call sites.
 * Returns null when AI_PROVIDER=none. Ollama uses local Gemma via /api/chat.
 */
export async function aiComplete(
  input: AiCompletionInput,
): Promise<string | null> {
  const provider: AiProvider = env.AI_PROVIDER as AiProvider;
  if (provider === "none") {
    console.log("[ai] provider=none, returning null (no AI configured)");
    return null;
  }
  if (provider === "ollama") return ollamaComplete(input);
  if (!env.AI_API_KEY) {
    console.warn(`[ai] provider=${provider} but AI_API_KEY is empty`);
    return null;
  }

  const baseUrl =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_API_KEY}`,
      ...(provider === "openrouter"
        ? { "HTTP-Referer": env.CLIENT_URL, "X-Title": "Inkwell" }
        : {}),
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [
        ...(input.system ? [{ role: "system", content: input.system }] : []),
        { role: "user", content: input.prompt },
      ],
      max_tokens: Math.min(input.maxTokens ?? 500, env.AI_MAX_TOKENS),
      stream: input.stream ?? false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[ai] provider=${provider} HTTP ${res.status}: ${body.slice(0, 200)}`);
    throw new Error(`AI provider ${res.status}: ${body.slice(0, 100)}`);
  }
  if (input.stream && res.body) return handleOpenAIStream(res);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? null;
}

async function handleOpenAIStream(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") break;
      try {
        const j = JSON.parse(data);
        const t = j.choices?.[0]?.delta?.content as string | undefined;
        if (t) full += t;
      } catch {}
    }
  }
  return full;
}

async function ollamaComplete(input: AiCompletionInput): Promise<string | null> {
  const base = env.OLLAMA_BASE_URL.replace(/\/$/, "");
  const model = env.OLLAMA_MODEL || "gemma4";
  const controller = new AbortController();
  const timeoutMs = input.maxTokens && input.maxTokens > 500 ? 300_000 : 120_000; // 5 min for long gen, 2 min for short
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[ai:ollama] calling model=${model} prompt=${input.prompt.slice(0, 80)}...`);
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          ...(input.system ? [{ role: "system", content: input.system }] : []),
          { role: "user", content: input.prompt },
        ],
        stream: false,
        options: { num_predict: Math.min(input.maxTokens ?? 500, env.AI_MAX_TOKENS) },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ai:ollama] HTTP ${res.status}: ${body.slice(0, 300)}`);
      throw new Error(`Ollama ${res.status}: ${body.slice(0, 100)}`);
    }
    const json = (await res.json()) as { message?: { content?: string } };
    const content = json.message?.content ?? null;
    if (content) {
      console.log(`[ai:ollama] response length=${content.length} chars`);
    } else {
      console.warn(`[ai:ollama] empty response from model=${model}`);
    }
    return content;
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error(`[ai:ollama] timeout after ${timeoutMs / 1000}s for model=${model}`);
      throw new Error(`Ollama request timed out (${timeoutMs / 1000}s). Model may be loading — try again.`);
    }
    console.error(`[ai:ollama] error: ${(err as Error).message}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** Streaming for Ollama + OpenAI-compatible */
export async function* aiStream(input: AiCompletionInput): AsyncGenerator<AiStreamChunk> {
  const provider = env.AI_PROVIDER as AiProvider;
  if (provider === "none") return;
  if (provider === "ollama") {
    yield* ollamaStream(input);
    return;
  }
  if (!env.AI_API_KEY) return;
  const baseUrl =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.AI_API_KEY}`,
      ...(provider === "openrouter" ? { "HTTP-Referer": env.CLIENT_URL, "X-Title": "Inkwell" } : {}),
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      messages: [
        ...(input.system ? [{ role: "system", content: input.system }] : []),
        { role: "user", content: input.prompt },
      ],
      max_tokens: Math.min(input.maxTokens ?? 800, env.AI_MAX_TOKENS),
      stream: true,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`AI stream ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        yield { text: "", done: true };
        return;
      }
      try {
        const j = JSON.parse(data);
        const t = j.choices?.[0]?.delta?.content as string | undefined;
        if (t) yield { text: t, done: false };
      } catch {}
    }
  }
  yield { text: "", done: true };
}

async function* ollamaStream(input: AiCompletionInput): AsyncGenerator<AiStreamChunk> {
  const base = env.OLLAMA_BASE_URL.replace(/\/$/, "");
  const model = env.OLLAMA_MODEL || "gemma4";
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        ...(input.system ? [{ role: "system", content: input.system }] : []),
        { role: "user", content: input.prompt },
      ],
      stream: true,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`Ollama stream ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split("\n")) {
      if (!line.trim()) continue;
      try {
        const j = JSON.parse(line);
        if (j.message?.content) yield { text: j.message.content, done: false };
        if (j.done) {
          yield { text: "", done: true };
          return;
        }
      } catch {}
    }
  }
  yield { text: "", done: true };
}
