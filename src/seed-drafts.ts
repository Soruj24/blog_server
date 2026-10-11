/**
 * OPTIONAL dev script — assigns newly generated DRAFT posts
 * to the 5 retained staff writers. Opt-in (never part of
 * `npm run seed`):
 *
 *   npm run seed:drafts
 *
 * Rules:
 * - Dev-only; refuses NODE_ENV=production like every seed entry.
 * - Idempotent: a draft with the same slug is skipped, so it can
 *   run any number of times without duplicating.
 * - Posts are DRAFTS (status "draft", no publishedAt, all counters
 *   zero) — no fake engagement, no fabricated publication history.
 *   Publishing/editing them is an editorial decision via the admin
 *   dashboard.
 * - Authors are resolved through their real Profile → User
 *   ObjectIds; posts reference the User _id, never a raw name.
 */
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { Category } from "./models/Category.js";
import { Post } from "./models/Post.js";
import { Profile } from "./models/Profile.js";
import { Tag } from "./models/Tag.js";
import { slugify } from "./utils/slug.js";
import { AUTHORS } from "./seed/data.js";

interface DraftSpec {
  author: string; // profile username
  title: string;
  excerpt: string;
  category: string; // category slug (retained set only)
  tags: string[];
  paragraphs: string[];
}

/** One draft per retained author, in that author's specialty. */
const DRAFTS: DraftSpec[] = [
  {
    author: "priya_sharma",
    title: "Shipping PyTorch Models Without Tears",
    excerpt: "The model is the easy part. Serving, monitoring, and rollback are where ML projects actually live or die.",
    category: "artificial-intelligence",
    tags: ["machine-learning", "python"],
    paragraphs: [
      "A trained model in a notebook is a prototype. A model behind a load balancer with latency budgets and a rollback plan is a product. The distance between the two is where most ML projects stall, and it is mostly unglamorous work: packaging, versioning, and deciding what happens when the model silently degrades.",
      "The setup that has saved my team the most pain is boring: a single training entry point, artifacts stored with their data snapshot, and a shadow mode that compares new predictions against the incumbent before anyone flips traffic. No clever infrastructure — just enough ceremony that 2am pages stay rare.",
    ],
  },
  {
    author: "diego_fernandez",
    title: "Component Architecture That Scales Past 100 Files",
    excerpt: "Folders are not architecture. A practical system for structuring React apps that outlives the first refactor.",
    category: "frontend-development",
    tags: ["react", "typescript", "frontend"],
    paragraphs: [
      "Every React codebase starts as a flat pile of components and ends as archaeology. The difference between the ones that age well and the ones that get rewritten is not talent — it is a small set of rules applied early: where shared components live, who may import what, and when a folder earns its boundary.",
      "The rule I defend hardest is dependency direction. Feature folders may import from shared, never the reverse, and shared never imports from features. It sounds trivial until the day you need to delete a feature and the bundler tells you the truth about what was actually coupled.",
    ],
  },
  {
    author: "omar_haddad",
    title: "API Design: The Boring Wins",
    excerpt: "Versioning, pagination, and error shapes. The unglamorous decisions that make APIs last.",
    category: "backend-development",
    tags: ["python", "apis", "backend"],
    paragraphs: [
      "Great APIs are boring in exactly the right places: predictable URLs, consistent error shapes, and pagination that works the same on every endpoint. Flashy features age; consistency compounds into trust.",
      "Three decisions worth making early: version from day one (even if v1 is all you ever ship), return errors that tell the client what to do, and never let a list endpoint grow without a limit parameter. Boring now means no breaking changes later, and breaking changes are the tax on everything you skipped.",
    ],
  },
  {
    author: "sarah_lindqvist",
    title: "Accessibility Is a Feature, Not a Checklist",
    excerpt: "Contrast ratios pass and users still get stuck. Treating accessibility as a launch gate changes what you design.",
    category: "ui-ux-design",
    tags: ["design", "accessibility"],
    paragraphs: [
      "It is easy to treat accessibility as a final audit: run the linter, fix the contrast, ship. But the teams that get it right bake it into the design phase — focus order is decided in the wireframe, not after the polish pass, and keyboard flows are prototyped alongside the visual mock.",
      "The cheapest habit I know: once a week, unplug the mouse for an hour and do your own product's core task with the keyboard only. Every confusing tab order you discover is a fix that costs minutes now and would cost a redesign later.",
    ],
  },
  {
    author: "fatima_alhassan",
    title: "Designing for the Traffic Spike You Hope Never Comes",
    excerpt: "Capacity planning is boring until the launch day that breaks the site. A calm approach to spikes.",
    category: "software-architecture",
    tags: ["cloud", "architecture"],
    paragraphs: [
      "Every launch has a spike, and every spike is a test of decisions made months earlier: what caches, what scales, what degrades gracefully. The teams that survive are not the ones with the biggest budgets — they are the ones that decided in advance what 'too busy' looks like.",
      "Start with a load test that resembles your worst realistic day, not a synthetic number. Then pick your pressure valve: queue it, cache it, or shed it. A feature that returns 'try again later' with a smile is a success story; a site that falls over entirely is not.",
    ],
  },
];

async function main(): Promise<void> {
  if (env.NODE_ENV === "production") {
    console.error("[seed:drafts] REFUSED: never seed in production");
    process.exit(1);
  }
  await connectDB();
  try {
    // Resolve every retained author up front — drafts reference the real
    // User ObjectId through the Profile, never a raw name string.
    const profiles = await Profile.find({
      username: { $in: AUTHORS.map((a) => a.username) },
    })
      .select("username user")
      .lean();
    const userByUsername = new Map(profiles.map((p) => [p.username, p.user]));

    // Categories and tags by slug (upsert tags the drafts need).
    const categories = await Category.find({}).select("_id slug").lean();
    const catBySlug = new Map(categories.map((c) => [c.slug, c._id]));
    const tagSlugs = [...new Set(DRAFTS.flatMap((d) => d.tags))];
    const tagBySlug = new Map<string, unknown>();
    for (const slug of tagSlugs) {
      const name = slug.replace(/-/g, " ");
      const tag = await Tag.findOneAndUpdate(
        { slug },
        { $setOnInsert: { name, slug } },
        { upsert: true, new: true },
      ).select("_id slug");
      tagBySlug.set(slug, tag._id);
    }

    let created = 0;
    let skipped = 0;
    let unresolved = 0;
    for (const d of DRAFTS) {
      const authorId = userByUsername.get(d.author);
      if (!authorId) {
        console.log(`[seed:drafts] no profile for author, skipping: ${d.author}`);
        unresolved += 1;
        continue;
      }
      const slug = slugify(d.title);
      const exists = await Post.exists({ slug });
      if (exists) {
        console.log(`[seed:drafts] draft exists, skipping: ${slug}`);
        skipped += 1;
        continue;
      }
      await Post.create({
        title: d.title,
        excerpt: d.excerpt,
        content: d.paragraphs.join("\n\n"),
        author: authorId,
        category: catBySlug.get(d.category) ?? null,
        tags: d.tags.map((t) => tagBySlug.get(t)).filter(Boolean),
        status: "draft",
        visibility: "public",
      });
      console.log(`[seed:drafts] draft: ${d.author} → ${slug}`);
      created += 1;
    }
    console.log(
      `[seed:drafts] done (${created} created, ${skipped} already present, ${unresolved} unresolved authors)`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(async (err) => {
  console.error("[seed:drafts] failed", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore teardown errors
  }
  process.exit(1);
});
