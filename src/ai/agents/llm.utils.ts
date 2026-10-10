import { z } from "zod";
import { aiComplete } from "../../config/ai.js";
 

const MAX_PARSE_RETRIES = 3;

/**
 * Call the LLM and parse structured JSON output.
 * Handles: raw text extraction, JSON repair, Zod validation, retry logic.
 */
export async function callAgent<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>,
  options?: { maxTokens?: number; label?: string },
): Promise<T> {
  const label = options?.label ?? "agent";
  const maxTokens = options?.maxTokens ?? 2000;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_PARSE_RETRIES; attempt++) {
    const raw = await aiComplete({
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens,
    });

    if (!raw) {
      lastError = new Error(`${label}: AI returned null`);
      continue;
    }

    const parsed = parseStructuredOutput(raw, schema);
    if (parsed.success) {
      if (attempt > 1) {
        console.log(`[ai:${label}] parsed on attempt ${attempt}`);
      }
      return parsed.data;
    }

    lastError = new Error(`${label}: parse failed — ${parsed.error}`);

    if (attempt < MAX_PARSE_RETRIES) {
      const repaired = attemptRepair(raw);
      if (repaired) {
        const repairedParsed = parseStructuredOutput(repaired, schema);
        if (repairedParsed.success) {
          console.log(`[ai:${label}] parsed on repair attempt ${attempt}`);
          return repairedParsed.data;
        }
      }
    }
  }

  throw lastError ?? new Error(`${label}: all parse attempts failed`);
}

function parseStructuredOutput<T>(raw: string, schema: z.ZodType<T>): { success: true; data: T } | { success: false; error: string } {
  const json = extractJson(raw);
  if (!json) return { success: false, error: "No JSON found in output" };

  try {
    const obj = JSON.parse(json);
    const result = schema.safeParse(obj);
    if (result.success) return { success: true, data: result.data };
    return { success: false, error: result.error.issues.map((i) => i.message).join("; ") };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

function extractJson(text: string): string | null {
  // Try direct parse first
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) return trimmed;

  // Try extracting from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  // Try finding first { to last }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
}

function attemptRepair(raw: string): string | null {
  const json = extractJson(raw);
  if (!json) return null;

  try {
    JSON.parse(json);
    return null; // Already valid
  } catch {
    // Try common repairs
    let repaired = json;

    // Remove trailing commas
    repaired = repaired.replace(/,\s*([}\]])/g, "$1");

    // Fix unescaped newlines in strings
    repaired = repaired.replace(/"([^"]*)"([^"]*)"/g, (_, a, b) => `"${a.replace(/\n/g, "\\n")}"${b}`);

    // Try to close unclosed arrays/objects
    const openBraces = (repaired.match(/{/g) || []).length;
    const closeBraces = (repaired.match(/}/g) || []).length;
    const openBrackets = (repaired.match(/\[/g) || []).length;
    const closeBrackets = (repaired.match(/]/g) || []).length;

    for (let i = 0; i < openBrackets - closeBrackets; i++) repaired += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) repaired += "}";

    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return null;
    }
  }
}

/**
 * Validate article content for basic quality signals.
 */
export function validateContentQuality(content: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (content.length < 200) issues.push("Content too short (< 200 chars)");
  if (content.split(/\s+/).filter(Boolean).length < 100) issues.push("Too few words (< 100)");

  const headings = content.match(/^#{1,3}\s+.+$/gm) || [];
  if (headings.length < 2) issues.push("Fewer than 2 headings");

  // Check for repetitive sentences
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 20);
  const unique = new Set(sentences.map((s) => s.trim().toLowerCase()));
  if (sentences.length > 5 && unique.size < sentences.length * 0.6) {
    issues.push("Excessive repetition detected");
  }

  // Check for empty sections
  const sections = content.split(/^#{2,3}\s+/m).filter(Boolean);
  const emptySections = sections.filter((s) => s.trim().length < 50);
  if (emptySections.length > 0) issues.push(`${emptySections.length} section(s) with insufficient content`);

  return { valid: issues.length === 0, issues };
}
