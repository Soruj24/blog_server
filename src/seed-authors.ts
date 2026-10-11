/**
 * Standalone author seed — creates exactly the 20 fictional staff
 * writer profiles (@inkwell.demo), independently of categories and
 * posts. Fully idempotent: existing emails/usernames are skipped,
 * never duplicated; real accounts are never touched.
 *
 *   npm run seed:authors
 */
import { fail, runSeed } from "./seed/index.js";

void runSeed({ fresh: false, steps: ["authors"], label: "seed:authors" }).catch(
  fail("seed:authors"),
);
