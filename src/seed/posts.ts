/**
 * Demo published posts. Default mode NEVER touches existing posts:
 * it only inserts when the posts collection is empty. --fresh
 * wipes and reseeds. After insert, denormalized counters are
 * recomputed so service invariants hold.
 */
import { Category } from "../models/Category.js";
import { Post } from "../models/Post.js";
import { Profile } from "../models/Profile.js";
import { Tag } from "../models/Tag.js";
import { POSTS, daysAgoDate } from "./data.js";

export async function seedPosts(fresh: boolean): Promise<void> {
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
