/**
 * Seed orchestrator. Every entry point (full seed, categories-only,
 * authors-only) goes through here so the safety rules are identical
 * everywhere:
 *
 * - REFUSES to run when NODE_ENV=production. Always. No override.
 * - Default mode never deletes anything; it only inserts/upserts.
 * - Steps are independent: run taxonomy without authors, etc.
 */
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { connectDB } from "../config/db.js";
import { seedUsers } from "./users.js";
import { seedAuthors } from "./authors.js";
import { seedTaxonomy } from "./taxonomy.js";
import { seedPosts } from "./posts.js";
import { recomputeCounters } from "./counters.js";

export type SeedStep = "users" | "authors" | "taxonomy" | "posts";

export interface RunSeedOptions {
  fresh: boolean;
  steps: SeedStep[];
  label: string;
}

export async function runSeed({ fresh, steps, label }: RunSeedOptions): Promise<void> {
  if (env.NODE_ENV === "production") {
    console.error(`[${label}] REFUSED: never seed in production`);
    process.exit(1);
  }
  await connectDB();
  try {
    for (const step of steps) {
      switch (step) {
        case "users":
          await seedUsers(fresh);
          break;
        case "authors":
          await seedAuthors();
          break;
        case "taxonomy":
          await seedTaxonomy(fresh);
          break;
        case "posts":
          await seedPosts(fresh);
          break;
      }
    }
    await recomputeCounters();
    console.log(`[${label}] done`);
  } finally {
    await mongoose.disconnect();
  }
}

/** Shared CLI error handler for seed entry points. */
export function fail(label: string): (err: unknown) => never {
  return (err) => {
    console.error(`[${label}] failed`, err);
    process.exit(1);
  };
}
