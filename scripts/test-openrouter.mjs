import { env } from "../dist/config/env.js";
import { aiComplete } from "../dist/config/ai.js";

console.log("AI_PROVIDER:", env.AI_PROVIDER);
console.log("AI_MODEL:", env.AI_MODEL);
console.log("AI_API_KEY:", env.AI_API_KEY ? env.AI_API_KEY.slice(0, 12) + "...(set)" : "(empty)");

const prompt = "Write a short blog post title (max 8 words) about TypeScript generics. Return only the title.";
const out = await aiComplete({
  prompt,
  system: "You are concise. Return only the requested text.",
  maxTokens: 60,
});

console.log("AI_RESPONSE:", JSON.stringify(out));
if (!out || !out.trim()) {
  console.error("TEST_FAILED: empty response");
  process.exit(1);
}
console.log("TEST_OK");
