/**
 * Always-on counter repair. seedPosts() skips recomputation when posts
 * already exist — but taxonomy/author expansion must still leave every
 * displayed count equal to actual published articles.
 */
import { Category } from "../models/Category.js";
import { Post } from "../models/Post.js";
import { Profile } from "../models/Profile.js";

export async function recomputeCounters(): Promise<void> {
  const categories = await Category.find({}).select("_id");
  for (const c of categories) {
    const count = await Post.countDocuments({ category: c._id, status: "published" });
    await Category.updateOne({ _id: c._id }, { postCount: count });
  }
  const authors = await Profile.find({}).select("user");
  for (const a of authors) {
    const count = await Post.countDocuments({ author: a.user, status: "published" });
    await Profile.updateOne({ user: a.user }, { postCount: count });
  }
  console.log(`[seed] counters verified (${categories.length} categories, ${authors.length} profiles)`);
}
