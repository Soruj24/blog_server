/**
 * AI-powered seed data generation CLI.
 *
 * Usage:
 *   npx tsx src/ai/cli/ai-generate.ts posts --count=10
 *   npx tsx src/ai/cli/ai-generate.ts posts --topics="React hooks,TypeScript generics"
 *   npx tsx src/ai/cli/ai-generate.ts single --topic="Modern CSS Layout Techniques"
 *
 * Environment:
 *   AI_PROVIDER=ollama (required — uses local Gemma)
 *   OLLAMA_MODEL=gemma4
 *   MONGODB_URI=...
 */

import mongoose from "mongoose";
import { connectDB } from "../../config/db.js";
import { env } from "../../config/env.js";
import { generateBlog, generateBlogs } from "../services/blog-generation.service.js";

const DEFAULT_TOPICS = [
  "Understanding TypeScript Generics",
  "React Server Components Deep Dive",
  "Building a Design System from Scratch",
  "Modern CSS Layout: Grid vs Flexbox",
  "API Design Best Practices for 2026",
  "Testing Strategies for Full-Stack Apps",
  "Database Indexing for Web Developers",
  "Authentication Patterns in Node.js",
  "Performance Budgets for Frontend Teams",
  "Code Review Culture: Building Quality",
  "Microservices vs Monolith: Practical Guide",
  "WebSocket Architecture for Real-Time Apps",
  "Docker for Development Environments",
  "GraphQL vs REST: When to Choose Which",
  "State Management in React: 2026 Edition",
  "Building Accessible Web Applications",
  "CI/CD Pipeline Design Patterns",
  "Error Handling Strategies for APIs",
  "Web Performance Metrics That Matter",
  "Technical Decision Making for Teams",
];

function parseArgs(): { command: string; count: number; topics?: string[] } {
  const args = process.argv.slice(2);
  const command = args[0] || "posts";

  let count = 5;
  let topics: string[] | undefined;

  for (const arg of args.slice(1)) {
    if (arg.startsWith("--count=")) {
      count = parseInt(arg.split("=")[1] || "5", 10);
    }
    if (arg.startsWith("--topics=")) {
      topics = arg
        .split("=")[1]
        ?.split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  return { command, count, topics };
}

async function generatePosts(count: number, topics?: string[]) {
  const selectedTopics = topics?.length ? topics : DEFAULT_TOPICS.slice(0, count);

  console.log(`\n[ai:generate] Generating ${selectedTopics.length} posts via ${env.AI_PROVIDER}/${env.OLLAMA_MODEL}`);
  console.log(`[ai:generate] Concurrency: ${env.AI_GEN_CONCURRENCY}\n`);

  const results = await generateBlogs({
    topics: selectedTopics,
    count,
    concurrency: env.AI_GEN_CONCURRENCY,
  });

  const succeeded = results.filter((r) => r.state.status === "passed");
  const failed = results.filter((r) => r.state.status === "failed");

  console.log(`\n[ai:generate] Results:`);
  console.log(`  Total:     ${results.length}`);
  console.log(`  Succeeded: ${succeeded.length}`);
  console.log(`  Failed:    ${failed.length}`);

  for (const r of results) {
    const icon = r.state.status === "passed" ? "+" : "x";
    const slug = r.saved?.slug ?? "not saved";
    console.log(`  [${icon}] ${r.state.topic.slice(0, 60)} → ${slug} (${r.state.status})`);
  }

  if (failed.length) {
    console.log(`\n[ai:generate] Failures:`);
    for (const r of failed) {
      console.log(`  - ${r.state.topic}: ${r.state.errors.join("; ")}`);
    }
  }
}

async function generateSingle(topic: string) {
  console.log(`\n[ai:generate] Generating single post: "${topic}"`);
  console.log(`[ai:generate] Provider: ${env.AI_PROVIDER}/${env.OLLAMA_MODEL}\n`);

  const result = await generateBlog({
    topic,
    authorUsername: "maya_writes",
    saveToDb: true,
  });

  console.log(`\n[ai:generate] Result:`);
  console.log(`  Status: ${result.state.status}`);
  console.log(`  Topic:  ${result.state.topic}`);
  if (result.saved) {
    console.log(`  Saved:  ${result.saved.postId} (${result.saved.slug})`);
  }
  if (result.state.draft) {
    const words = result.state.draft.content.split(/\s+/).length;
    console.log(`  Words:  ${words}`);
  }
  console.log(`  Timings: ${JSON.stringify(result.state.agentTimings)}`);
  if (result.state.errors.length) {
    console.log(`  Errors: ${result.state.errors.join("; ")}`);
  }
}

async function main() {
  if (env.NODE_ENV === "production") {
    console.error("[ai:generate] REFUSED: never run AI generation in production");
    process.exit(1);
  }

  if (env.AI_PROVIDER === "none") {
    console.error("[ai:generate] AI_PROVIDER is 'none'. Set AI_PROVIDER=ollama for live generation.");
    process.exit(1);
  }

  const { command, count, topics } = parseArgs();

  await connectDB();

  try {
    if (command === "single") {
      const topic = topics?.[0] || "Understanding TypeScript Generics";
      await generateSingle(topic);
    } else {
      await generatePosts(count, topics);
    }
  } finally {
    await mongoose.disconnect();
    console.log("\n[ai:generate] Done.");
  }
}

main().catch(async (err) => {
  console.error("[ai:generate] Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
