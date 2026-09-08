/**
 * One-time index maintenance: aligns DB indexes with schema definitions.
 * Needed after editing an existing index (e.g. the weighted post text
 * index) — Mongoose creates missing indexes automatically but never
 * rebuilds changed ones.
 *
 *   npm run db:sync
 *
 * Refuses production (index rebuilds can lock collections); production
 * index changes belong in a reviewed migration, not a dev script.
 */
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import "./models/index.js";

async function main() {
  if (env.NODE_ENV === "production") {
    console.error("[db:sync] REFUSED in production — use a migration instead");
    process.exit(1);
  }
  await connectDB();
  for (const name of mongoose.modelNames()) {
    const changes = await mongoose.model(name).syncIndexes();
    console.log(`[db:sync] ${name}: +${changes.length} index changes`);
  }
  console.log("[db:sync] done");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[db:sync] failed", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors during failure teardown
  }
  process.exit(1);
});
