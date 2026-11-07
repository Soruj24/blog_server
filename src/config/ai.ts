import { env } from "./env.js";

export type AiProvider = "openrouter" | "groq" | "none";

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

// Approximate USD pricing per 1M tokens (OpenRouter, input/output).
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "openai/gpt-5-mini": { input: 0.25, output: 2.0 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "meta-llama/llama-3.3-70b-instruct": { input: 0.1, output: 0.32 },
  "llama-3.1-8b-instant": { input: 0.05, output: 0.08 },
};

export function getModelCostHint(model: string): string {
  const price = MODEL_PRICING[model];
  if (!price) return "Cost varies by model";
  return `~$${price.input.toFixed(2)} in / $${price.output.toFixed(2)} out per 1M tokens`;
}

/**
 * Configurable AI layer — OpenRouter/Groq (OpenAI-compatible).
 * No vendor SDK; plain fetch so swapping providers never touches call sites.
 * Returns null when AI_PROVIDER=none.
 */
export async function aiComplete(
  input: AiCompletionInput,
): Promise<string | null> {
  const provider: AiProvider = env.AI_PROVIDER as AiProvider;
  if (provider === "none") {
    console.log("[ai] provider=none, returning null (no AI configured)");
    return null;
  }
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

/** Streaming for OpenAI-compatible providers (OpenRouter/Groq). */
export async function* aiStream(input: AiCompletionInput): AsyncGenerator<AiStreamChunk> {
  const provider = env.AI_PROVIDER as AiProvider;
  if (provider === "none") return;
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
