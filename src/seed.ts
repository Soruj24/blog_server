/**
 * DEV-ONLY database seed — sample blog content for local development.
 *
 *   npm run seed          # insert demo data (refuses if posts already exist)
 *   npm run seed:fresh     # wipe demo data first, then reseed
 *
 * Safety rules:
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
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { Category } from "./models/Category.js";
import { Post } from "./models/Post.js";
import { Profile } from "./models/Profile.js";
import { Tag } from "./models/Tag.js";
import { User } from "./models/User.js";
import { register } from "./services/auth.service.js";

const DEMO_PASSWORD = "DemoPass123!";
const DEMO_DOMAIN = "@inkwell.demo";

const DEMO_USERS = [
  { name: "Admin", email: `admin${DEMO_DOMAIN}`, username: "admin", role: "admin" },
  { name: "Maya Chen", email: `maya${DEMO_DOMAIN}`, username: "maya_writes", role: "author" },
  { name: "Jonas Weber", email: `jonas${DEMO_DOMAIN}`, username: "jonas_weber", role: "editor" },
] as const;

const CATEGORIES = [
  { name: "Technology", slug: "technology", description: "Engineering, tooling, and how software gets built.", color: "#0f172a", order: 1 },
  { name: "Design", slug: "design", description: "Interfaces, typography, and design systems.", color: "#7c3aed", order: 2 },
  { name: "Productivity", slug: "productivity", description: "Focus, habits, and doing deep work.", color: "#047857", order: 3 },
  { name: "Culture", slug: "culture", description: "How teams work and what the industry is becoming.", color: "#b45309", order: 4 },
];

const TAGS = [
  "javascript", "typescript", "react", "nodejs", "design-systems",
  "typography", "deep-work", "remote-work", "writing", "ai", "css", "craft",
];

interface SeedPost {
  title: string;
  excerpt: string;
  body: string[];
  coverSeed: string;
  author: string;
  category: string;
  tags: string[];
  daysAgo: number;
  views: number;
  likes: number;
  bookmarks: number;
  comments: number;
  featured?: boolean;
  trending?: boolean;
}

const POSTS: SeedPost[] = [
  {
    title: "The Quiet Craft of Writing Software That Lasts",
    excerpt: "Most code is read far more than it is written. Here's how to write for the reader who arrives at 2am, six months from now — likely you.",
    body: [
      "Every codebase has a ghost: the engineer who will inherit it next. Sometimes that ghost is a stranger. More often, it is you, six months older, staring at a function you swore was obvious at the time. Writing software that lasts is less about cleverness than about empathy — leaving a trail of small, kind decisions for whoever walks the path after you.",
      "The first habit is naming things as if the reader is tired, because they will be. A variable called `data` tells the next reader nothing; a variable called `unverifiedEmails` tells them almost everything. Good names compress context. They turn a twenty-minute archaeology dig through call sites into a two-second glance. This is the cheapest form of documentation that exists, and the one most teams neglect.",
      "The second habit is deleting with enthusiasm. Every line of code is a liability that must be read, tested, and maintained. The best pull requests I have reviewed this year removed more than they added. A smaller codebase is a more comprehensible one, and comprehensibility is the only performance metric that compounds across every engineer who ever touches the project.",
      "None of this is glamorous. There is no conference talk titled after the afternoon you renamed forty variables. But durability is a craft, and crafts are built from unglamorous repetitions. Write the boring code. Name the tired-reader variables. Delete the clever abstraction. The ghost will thank you.",
    ],
    coverSeed: "inkwell-craft",
    author: "maya_writes",
    category: "technology",
    tags: ["craft", "javascript", "writing"],
    daysAgo: 2,
    views: 4821,
    likes: 312,
    bookmarks: 148,
    comments: 24,
    featured: true,
    trending: true,
  },
  {
    title: "Design Systems Are About People, Not Pixels",
    excerpt: "A design system fails the moment it becomes a component catalog. The real product is shared language between designers and engineers.",
    body: [
      "Ask five teams what a design system is and you will hear five answers: a Figma library, a Storybook, a set of tokens, a governance process. All of these are artifacts. None of them is the system. The system is the set of agreements between the people who ship the product — what a button means, who decides, and how disagreement gets resolved.",
      "This is why so many design systems die as beautiful, unused museums. A team publishes sixty pixel-perfect components, announces them in a launch thread, and watches adoption flatline. The components were never the bottleneck. The bottleneck was that nobody agreed on when to use the destructive button versus the danger banner, or who approves a new pattern, or what happens when the system says no.",
      "Successful systems start embarrassingly small: three colors, two type scales, one button, and a weekly thirty-minute meeting where designers and engineers argue productively. They grow by absorbing real product needs, not by anticipating them. Every component should have a scar — a story about the product problem that forced it into existence.",
      "If you are starting a design system this quarter, skip the audit of all fifty button variants. Instead, write one page: principles, decision owners, and the contribution process. Pixels are the easy part. People are the system.",
    ],
    coverSeed: "inkwell-systems",
    author: "jonas_weber",
    category: "design",
    tags: ["design-systems", "craft"],
    daysAgo: 4,
    views: 3150,
    likes: 204,
    bookmarks: 96,
    comments: 18,
    featured: true,
  },
  {
    title: "A Field Guide to Deep Work in a Distracted World",
    excerpt: "Attention is the last scarce resource in knowledge work. A practical system for protecting it, from someone who failed at it for years.",
    body: [
      "I spent three years telling myself I did my best thinking in fifteen-minute gaps between meetings. I was wrong in a way that cost me roughly a book's worth of ideas. Shallow work feels productive because it generates motion — replies sent, threads closed, dots connected. Deep work feels unproductive because for the first forty minutes, nothing happens. Then everything happens.",
      "The system that finally worked for me has exactly three rules. First, calendar beats willpower: two ninety-minute blocks per day, labeled, non-negotiable, treated with the seriousness of a flight you cannot miss. If deep work is not on the calendar, the calendar will fill with other people's priorities. It always does.",
      "Second, the shutdown ritual. At the end of each block I write three sentences: what I did, what is next, what is blocked. This takes four minutes and buys something priceless — the ability to stop thinking about the problem. An open loop will follow you into dinner, workouts, and sleep. Close it on paper so your brain gets the evening off.",
      "Third, measure inputs, not outputs. You cannot schedule an insight, but you can schedule ninety uninterrupted minutes. Track the blocks, not the breakthroughs. Four blocks a week sustained for a year will outperform any heroic crunch, and you will still recognize your family in December.",
    ],
    coverSeed: "inkwell-deepwork",
    author: "maya_writes",
    category: "productivity",
    tags: ["deep-work", "writing"],
    daysAgo: 6,
    views: 5930,
    likes: 428,
    bookmarks: 231,
    comments: 41,
    trending: true,
  },
  {
    title: "What I Learned Rebuilding Our API From Scratch",
    excerpt: "We threw away eighteen months of endpoints and lived to tell the tale. The technical lessons were the easy part.",
    body: [
      "The old API had grown the way old APIs do: one expedient at a time. There was the endpoint that returned three different shapes depending on a query parameter nobody remembered adding. There was the field named `temp_final_v2`. When new engineers took six weeks to make their first confident change, we knew it was time. So we did the thing everyone warns you about: we rewrote it.",
      "Technically, the rewrite was straightforward. We versioned aggressively, froze the old surface, and built the new one alongside it with a strangler proxy routing traffic endpoint by endpoint. The strangler pattern deserves its reputation — it turned a terrifying big bang into ninety boring Tuesdays. Boring is the highest compliment infrastructure work can receive.",
      "The surprising lessons were organizational. First: the rewrite forced us to discover what the API actually did, because nobody knew. We found eleven endpoints with zero traffic in six months. Deleting them was the most valuable part of the project. Second: writing the migration guide taught us more about our own product than any planning meeting had. Documentation is discovery wearing a trench coat.",
      "Would I do it again? Only with the same guardrails: traffic parity checks, per-endpoint rollout, and a written list of what we refuse to carry over. Rewrites fail when they try to preserve everything. Ours succeeded because we treated it as an excuse to forget.",
    ],
    coverSeed: "inkwell-api",
    author: "jonas_weber",
    category: "technology",
    tags: ["nodejs", "typescript", "craft"],
    daysAgo: 9,
    views: 2214,
    likes: 156,
    bookmarks: 73,
    comments: 19,
  },
  {
    title: "Typography Is the Voice of Your Interface",
    excerpt: "Users never compliment your type scale. They just feel that your product sounds trustworthy — or doesn't. Here's how to make it sing.",
    body: [
      "Every interface speaks. Before a user reads a single word, your typography has already told them whether you are careful or careless, playful or severe, confident or anxious. Type is the voice of the product, and most products are mumbling.",
      "The fix is rarely a new font. It is hierarchy with conviction. Pick two sizes that do 80 percent of the work — one for reading, one for scanning — and defend the gap between them. When everything is slightly larger than everything else, nothing is. Contrast is information. A timid scale whispers; a confident one guides.",
      "Then mind the details nobody notices until they are wrong: line length between 45 and 75 characters, line height that grows as size shrinks, and letter spacing that tightens on large display type. These are not aesthetic indulgences. Reading comfort is retention. A paragraph that tires the eye is a user who leaves.",
      "Finally, read your own product out loud in the voice your type implies. If the words sound wrong in that voice, the problem might not be the words. Great interfaces do not just look right — they sound right, silently, on every screen.",
    ],
    coverSeed: "inkwell-type",
    author: "maya_writes",
    category: "design",
    tags: ["typography", "css", "design-systems"],
    daysAgo: 12,
    views: 4102,
    likes: 389,
    bookmarks: 187,
    comments: 33,
    trending: true,
  },
  {
    title: "The Slow Web: In Praise of Boring Technology",
    excerpt: "The most radical thing you can ship in 2026 might be a page that loads instantly, works offline, and respects its reader.",
    body: [
      "Somewhere along the way, the average web page became a small operating system: megabytes of JavaScript to render what is, essentially, a document. We did this for good reasons — interactivity, richness, ambition — and then kept doing it long after the reasons expired. The result is a web that feels heavy on hardware that should make it fly.",
      "The slow web movement is not nostalgia. It is engineering discipline applied to the reader's experience. Server-render the document. Ship JavaScript like a seasoning, not a foundation. Measure on a three-year-old phone on a train, because that is where a remarkable amount of reading happens.",
      "Boring technology compounds. A static page has no runtime to patch, no hydration mismatch to debug, no framework upgrade to dread. Every dependency you decline is a future incident you prevented. Choose the boring option until the interesting one earns its complexity with evidence, not enthusiasm.",
      "Readers notice. They may not file a ticket saying your time-to-meaningful-paint delighted them, but they stay longer, bounce less, and come back. Performance is a feature, accessibility is a feature, and respect — for devices, networks, and attention — is the rarest feature of all.",
    ],
    coverSeed: "inkwell-slowweb",
    author: "jonas_weber",
    category: "culture",
    tags: ["craft", "react", "writing"],
    daysAgo: 15,
    views: 2876,
    likes: 241,
    bookmarks: 112,
    comments: 27,
  },
  {
    title: "How We Cut Our Bundle Size in Half",
    excerpt: "No heroics, no rewrite — just a methodical audit, a budget, and the willingness to delete beloved dependencies.",
    body: [
      "Our bundle had reached the point where the loading spinner needed its own loading spinner. The audit that fixed it took one engineer, three days, and a spreadsheet. Step one was measurement: a bundle analyzer report, sorted by size, taped metaphorically to the wall. You cannot argue with a treemap. The treemap does not care about your feelings toward that date library.",
      "The biggest wins were embarrassingly unglamorous. A charting library imported in full for one sparkline — replaced with forty lines of SVG. Three icon packs serving twelve icons — replaced with inline paths. A utility library where we used six functions — replaced with the six functions. Dependencies are not free; each one is a subscription you pay on every page load, forever.",
      "Then came the budget: a CI check that fails the build if the bundle grows beyond an agreed number. Budgets work because they move the conversation from taste to arithmetic. Nobody has to be the person who says no to a shiny library. The number says no, politely, automatically, at 3am if necessary.",
      "We halved the bundle and the bounce rate followed. The lesson generalizes uncomfortably well: most performance problems are inventory problems. Before reaching for the exotic tool, count what you already have. The treemap is waiting.",
    ],
    coverSeed: "inkwell-bundle",
    author: "maya_writes",
    category: "technology",
    tags: ["javascript", "react", "craft"],
    daysAgo: 19,
    views: 1988,
    likes: 132,
    bookmarks: 61,
    comments: 14,
  },
  {
    title: "Morning Pages for Engineers",
    excerpt: "Three pages of longhand, written before the inbox wakes up. The strangest productivity tool I have ever stuck with.",
    body: [
      "The practice is simple to the point of suspicion: every morning, write three longhand pages about anything. Not a journal with an audience. Not notes toward a goal. Just the unfiltered static of your mind, captured before the day's inputs overwrite it. I resisted for months because it sounded like superstition. Then I tried it for thirty days and did not stop.",
      "The mechanism, as far as I can tell, is externalization. Engineers carry enormous mental state — half-formed designs, background worries, the argument from yesterday's review. Writing it down moves it from working memory to paper, freeing the RAM for actual thinking. Bugs I had been circling for days tended to resolve on page two, in embarrassing plain language.",
      "There are rules that matter. Longhand, not typing — the slowness is the point; your hand cannot outrun your thoughts the way your fingers can. Private, not shared — the moment an audience exists, honesty leaves. And morning, not evening — you are capturing the mind before the world calibrates it, not reviewing what the world already did.",
      "Is it the writing that works, or just the quiet? Honestly, probably both, and I have stopped caring about the ratio. Thirty minutes, a cheap notebook, no app, no streak counter, no subscription. In an industry that sells complexity, the tools that survive are the ones too simple to break.",
    ],
    coverSeed: "inkwell-morning",
    author: "jonas_weber",
    category: "productivity",
    tags: ["deep-work", "writing", "remote-work"],
    daysAgo: 24,
    views: 1745,
    likes: 168,
    bookmarks: 89,
    comments: 22,
  },
  {
    title: "Why Every Team Needs a Writing Culture",
    excerpt: "Meetings scale linearly. Documents scale infinitely. The highest-leverage habit a growing team can build is writing things down.",
    body: [
      "Every growing team hits the same wall: the information that used to travel by osmosis — across two desks, in one standup — suddenly needs to cross time zones and org charts. The default response is more meetings, which scales exactly as badly as it sounds. The alternative is writing: decisions, context, and reasoning, captured where anyone can find them later.",
      "Writing forces a clarity that talking never demands. A vague idea survives a whiteboard session because nods are cheap. It does not survive a one-page proposal, because prose has nowhere to hide. Teams that write make better decisions for the simple reason that bad reasoning is visible on the page in a way it never is in a meeting.",
      "The objection is always time. Writing takes longer than talking — true, for the author, once. But a thirty-minute document replaces five recurring meetings and answers the same question for every future hire. Meetings are rented; documents are owned. The math only looks bad if you count the author's hour and ignore everyone else's.",
      "Start embarrassingly small: decisions in writing, with the reasoning attached, stored where the team already looks. No templates, no process rollout, no grand announcement. Culture is what gets repeated, and the most repeatable unit in knowledge work is a good document.",
    ],
    coverSeed: "inkwell-writing",
    author: "maya_writes",
    category: "culture",
    tags: ["writing", "remote-work", "craft"],
    daysAgo: 29,
    views: 2567,
    likes: 219,
    bookmarks: 104,
    comments: 26,
  },
];

const AUTHOR_BIOS: Record<string, { bio: string; avatarSeed: string }> = {
  maya_writes: {
    bio: "Staff engineer writing about software craft, focus, and the human side of building. Previously shipped APIs you have probably cursed at.",
    avatarSeed: "inkwell-maya",
  },
  jonas_weber: {
    bio: "Designer-engineer hybrid. Writes about interfaces, systems, and why the boring option usually wins.",
    avatarSeed: "inkwell-jonas",
  },
};

function daysAgoDate(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function seedUsers(fresh: boolean) {
  if (fresh) {
    const demoUsers = await User.find({ email: { $regex: `@inkwell\\.demo$` } }).select("_id");
    const ids = demoUsers.map((u) => u._id);
    await Profile.deleteMany({ user: { $in: ids } });
    await User.deleteMany({ _id: { $in: ids } });
    console.log("[seed] removed previous demo users");
  }

  for (const demo of DEMO_USERS) {
    const exists = await User.exists({ email: demo.email });
    if (exists) {
      console.log(`[seed] user exists, skipping: ${demo.email}`);
      continue;
    }
    // First-ever user auto-becomes admin via register(); enforce demo roles explicitly.
    await register({ name: demo.name, email: demo.email, password: DEMO_PASSWORD, username: demo.username });
    await User.updateOne({ email: demo.email }, { role: demo.role });
    console.log(`[seed] created ${demo.role}: ${demo.email}`);
  }

  for (const [username, meta] of Object.entries(AUTHOR_BIOS)) {
    const user = await User.findOne({ email: `${username.split("_")[0]}${DEMO_DOMAIN}` }).select("_id");
    if (!user) continue;
    await Profile.updateOne(
      { user: user._id },
      {
        bio: meta.bio,
        avatarUrl: `https://picsum.photos/seed/${meta.avatarSeed}/200/200`,
        location: username === "maya_writes" ? "Berlin" : "Zurich",
        website: "https://inkwell.demo",
      },
    );
  }
}

async function seedTaxonomy(fresh: boolean) {
  if (fresh) {
    await Category.deleteMany({});
    await Tag.deleteMany({});
    console.log("[seed] cleared categories + tags");
  }
  for (const c of CATEGORIES) {
    await Category.updateOne({ slug: c.slug }, { $setOnInsert: c }, { upsert: true });
  }
  for (const slug of TAGS) {
    const name = slug.replace(/-/g, " ");
    await Tag.updateOne({ slug }, { $setOnInsert: { name, slug } }, { upsert: true });
  }
  console.log("[seed] categories + tags ready");
}

async function seedPosts(fresh: boolean) {
  if (fresh) {
    await Post.deleteMany({});
    console.log("[seed] cleared posts");
  }

  const existing = await Post.estimatedDocumentCount();
  if (existing > 0 && !fresh) {
    console.log(`[seed] ${existing} posts already exist — nothing to do (use --fresh to reseed)`);
    return;
  }

  const categories = await Category.find({}).select("_id slug");
  const tags = await Tag.find({}).select("_id slug");
  const catBySlug = new Map(categories.map((c) => [c.slug, c._id]));
  const tagBySlug = new Map(tags.map((t) => [t.slug, t._id]));

  for (const p of POSTS) {
    const profile = await Profile.findOne({ username: p.author }).select("user");
    if (!profile) throw new Error(`author profile missing: ${p.author}`);
    const publishedAt = daysAgoDate(p.daysAgo);
    await Post.create({
      title: p.title,
      excerpt: p.excerpt,
      content: p.body.join("\n\n"),
      coverImage: `https://picsum.photos/seed/${p.coverSeed}/1200/800`,
      author: profile.user,
      category: catBySlug.get(p.category) ?? null,
      tags: p.tags.map((t) => tagBySlug.get(t)).filter(Boolean),
      status: "published",
      visibility: "public",
      featured: p.featured ?? false,
      trending: p.trending ?? false,
      views: p.views,
      likeCount: p.likes,
      bookmarkCount: p.bookmarks,
      commentCount: p.comments,
      publishedAt,
    });
    console.log(`[seed] post: ${p.title.slice(0, 50)}…`);
  }

  // Recompute denormalized counters so the seed matches service invariants.
  for (const c of categories) {
    const count = await Post.countDocuments({ category: c._id, status: "published" });
    await Category.updateOne({ _id: c._id }, { postCount: count });
  }
  for (const t of tags) {
    const count = await Post.countDocuments({ tags: t._id, status: "published" });
    await Tag.updateOne({ _id: t._id }, { postCount: count });
  }
  const authors = await Profile.find({}).select("user");
  for (const a of authors) {
    const count = await Post.countDocuments({ author: a.user, status: "published" });
    await Profile.updateOne({ user: a.user }, { postCount: count });
  }
  console.log("[seed] counters recomputed");
}

async function main() {
  if (env.NODE_ENV === "production") {
    console.error("[seed] REFUSED: never seed in production");
    process.exit(1);
  }
  const fresh = process.argv.includes("--fresh");
  await connectDB();
  await seedUsers(fresh);
  await seedTaxonomy(fresh);
  await seedPosts(fresh);
  console.log("[seed] done");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("[seed] failed", err);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore disconnect errors during failure teardown
  }
  process.exit(1);
});
