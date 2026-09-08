import "dotenv/config";
import { z } from "zod";

/**
 * Single source of truth for server env.
 * Fails fast on boot if required vars are missing — never run with bad config.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),

  // Must match Auth.js AUTH_SECRET so Express can verify its JWTs.
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 chars"),

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),

  // Configurable AI provider — no SDK lock-in, plain HTTPS via fetch.
  // Supports OpenRouter/Groq (OpenAI-compatible) + local Ollama (deep agent)
  AI_PROVIDER: z.enum(["openrouter", "groq", "ollama", "none"]).default("none"),
  AI_API_KEY: z.string().optional().default(""),
  AI_MODEL: z.string().optional().default(""),
  OLLAMA_BASE_URL: z.string().url().optional().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().optional().default("gemma4"),
  // Cost awareness: max tokens per request to bound cost
  AI_MAX_TOKENS: z.coerce.number().default(2000),
  AI_RATE_LIMIT_PER_MIN: z.coerce.number().default(20),

  // Blog generation pipeline config
  AI_GEN_CONCURRENCY: z.coerce.number().default(2),
  AI_GEN_TIMEOUT_MS: z.coerce.number().default(300_000),
  AI_GEN_MAX_RETRIES: z.coerce.number().default(2),
  AI_GEN_MAX_REVISIONS: z.coerce.number().default(2),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
