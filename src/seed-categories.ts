/**
 * Standalone category seed — runs independently of authors, users,
 * and posts. Safe to run any number of times: inserts only the
 * categories that are missing and never renames or reorders
 * existing ones (empty icon/SEO fields are backfilled).
 *
 *   npm run seed:categories
 *   npm run seed:categories -- --fresh   # dev-only wipe + reseed
 */
import { fail, runSeed } from "./seed/index.js";

const fresh = process.argv.includes("--fresh");

void runSeed({ fresh, steps: ["taxonomy"], label: "seed:categories" }).catch(
  fail("seed:categories"),
);
