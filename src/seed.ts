/**
 * DEV-ONLY database seed — sample blog content for local development.
 *
 *   npm run seed              # insert demo data (refuses if posts already exist)
 *   npm run seed:fresh        # wipe demo data first, then reseed
 *   npm run seed:categories   # categories + tags only (idempotent)
 *   npm run seed:authors      # the 20 staff-writer profiles only (idempotent)
 *   npm run seed:drafts       # optional: assign draft posts to seeded authors
 *
 * Safety rules (enforced in ./seed/index.ts):
 * - Refuses to run when NODE_ENV=production. Always. No override flag.
 * - Default mode never deletes anything; it only inserts.
 * - --fresh deletes posts/categories/tags plus demo (@inkwell.demo) users
 *   and their profiles. Real user accounts are NEVER touched.
 * - Demo credentials are documented below — obvious, unguessable enough
 *   for local dev, useless anywhere else.
 *
 * Demo logins (password for all: DemoPass123!):
 *   admin@inkwell.demo  (admin)
 *   maya@inkwell.demo   (author)
 *   jonas@inkwell.demo  (editor — also authors, for moderation testing)
 */
import { fail, runSeed } from "./seed/index.js";

const fresh = process.argv.includes("--fresh");

void runSeed({
  fresh,
  steps: ["users", "authors", "taxonomy", "posts"],
  label: "seed",
}).catch(fail("seed"));
