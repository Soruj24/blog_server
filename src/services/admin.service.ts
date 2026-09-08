import { v2 as cloudinary } from "cloudinary";
import type { PipelineStage } from "mongoose";
import { Bookmark } from "../models/Bookmark.js";
import { Category } from "../models/Category.js";
import { Comment } from "../models/Comment.js";
import { Like } from "../models/Like.js";
import { Media } from "../models/Media.js";
import { NewsletterSubscriber } from "../models/NewsletterSubscriber.js";
import { Post } from "../models/Post.js";
import { PostView } from "../models/PostView.js";
import { SiteSettings } from "../models/SiteSettings.js";
import { Tag } from "../models/Tag.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import type {
  BulkCommentsInput,
  BulkPostsInput,
  UpdateSettingsInput,
} from "../validations/admin.validation.js";

/** Escape user text for $regex — never let raw input become a pattern. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------- overview ------------------------------- */

const statsCache = new Map<string, { data: unknown; exp: number }>();

/** Dashboard cards: one parallel fan-out, all counts server-side. Cached 30s to avoid DB hammer on poll. */
export async function getStats() {
  const key = "stats";
  const cached = statsCache.get(key);
  if (cached && Date.now() < cached.exp) return cached.data as Awaited<ReturnType<typeof getStatsInternal>>;
  const data = await getStatsInternal();
  statsCache.set(key, { data, exp: Date.now() + 30000 });
  return data;
}
async function getStatsInternal() {
  const [
    postStatus,
    userCount,
    commentStatus,
    postSums,
    likeCount,
    bookmarkCount,
    activeSubs,
  ] = await Promise.all([
    Post.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    User.countDocuments(),
    Comment.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    Post.aggregate<{ views: number; likes: number; bookmarks: number }>([
      {
        $group: {
          _id: null,
          views: { $sum: "$views" },
          likes: { $sum: "$likeCount" },
          bookmarks: { $sum: "$bookmarkCount" },
        },
      },
    ]),
    Like.countDocuments({ targetKind: "Post" }),
    Bookmark.countDocuments(),
    NewsletterSubscriber.countDocuments({ status: "active" }),
  ]);

  const byStatus = (rows: Array<{ _id: string; n: number }>, key: string) =>
    rows.find((r) => r._id === key)?.n ?? 0;

  return {
    posts: {
      total: postStatus.reduce((s, r) => s + r.n, 0),
      published: byStatus(postStatus, "published"),
      draft: byStatus(postStatus, "draft"),
      scheduled: byStatus(postStatus, "scheduled"),
      archived: byStatus(postStatus, "archived"),
    },
    users: { total: userCount },
    comments: {
      total: commentStatus.reduce((s, r) => s + r.n, 0),
      pending: byStatus(commentStatus, "pending"),
    },
    views: postSums[0]?.views ?? 0,
    likes: likeCount,
    bookmarks: bookmarkCount,
    newsletter: { active: activeSubs },
  };
}

/* --------------------------------- posts -------------------------------- */

export interface AdminPostsFilter {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}

/** All statuses, newest first — the moderator's view of everything. */
export async function listAdminPosts(filter: AdminPostsFilter) {
  const query: Record<string, unknown> = {};
  if (filter.status) query["status"] = filter.status;
  if (filter.search) {
    const rx = { $regex: escapeRegExp(filter.search), $options: "i" };
    query["$or"] = [{ title: rx }, { excerpt: rx }];
  }
  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Post.find(query)
      .select("title slug status visibility views likeCount commentCount publishedAt createdAt author category")
      .populate("author", "name")
      .populate("category", "name slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit)
      .lean(),
    Post.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit };
}

/** Bulk status transitions + delete with full engagement cascade. */
export async function bulkPosts(input: BulkPostsInput) {
  const { ids, action } = input;
  if (action === "delete") {
    const posts = await Post.find({ _id: { $in: ids } }).select("_id category tags").lean();
    const postIds = posts.map((p) => p._id);
    await Promise.all([
      Post.deleteMany({ _id: { $in: postIds } }),
      Like.deleteMany({ targetKind: "Post", target: { $in: postIds } }),
      Bookmark.deleteMany({ post: { $in: postIds } }),
      Comment.deleteMany({ post: { $in: postIds } }),
      PostView.deleteMany({ post: { $in: postIds } }),
      Media.updateMany({ post: { $in: postIds } }, { $unset: { post: "" } }),
    ]);
    // Recompute taxonomy counters for every touched category/tag.
    const catIds = [...new Set(posts.flatMap((p) => (p.category ? [String(p.category)] : [])))];
    const tagIds = [...new Set(posts.flatMap((p) => (p.tags ?? []).map(String)))];
    await Promise.all([
      ...catIds.map(async (id) => {
        const count = await Post.countDocuments({ category: id, status: "published" });
        await Category.updateOne({ _id: id }, { postCount: count });
      }),
      ...tagIds.map(async (id) => {
        const count = await Post.countDocuments({ tags: id, status: "published" });
        await Tag.updateOne({ _id: id }, { postCount: count });
      }),
    ]);
    return { updated: postIds.length };
  }

  const status = action === "publish" ? "published" : action === "draft" ? "draft" : "archived";
  const patch: Record<string, unknown> = { status };
  if (action === "publish") patch["publishedAt"] = new Date();
  const res = await Post.updateMany({ _id: { $in: ids } }, patch);
  return { updated: res.modifiedCount };
}

/* -------------------------------- comments ------------------------------- */

export interface AdminCommentsFilter {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}

export async function listAdminComments(filter: AdminCommentsFilter) {
  const query: Record<string, unknown> = {};
  if (filter.status) query["status"] = filter.status;
  if (filter.search) {
    query["content"] = { $regex: escapeRegExp(filter.search), $options: "i" };
  }
  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Comment.find(query)
      .select("content status likeCount post author parent createdAt")
      .populate("author", "name email")
      .populate("post", "title slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit)
      .lean(),
    Comment.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit };
}

/** Repair per-post visible counts after moderation deletes. */
async function repairPostCounts(postIds: unknown[]) {
  const unique = [...new Set(postIds.map(String))];
  await Promise.all(
    unique.map(async (id) => {
      const count = await Comment.countDocuments({ post: id, status: "approved" });
      await Post.updateOne({ _id: id }, { commentCount: count });
    }),
  );
}

export async function bulkComments(input: BulkCommentsInput) {
  const { ids, action } = input;
  if (action === "delete") {
    const docs = await Comment.find({ _id: { $in: ids } }).select("_id post").lean();
    const postIds = docs.map((d) => d.post);
    await Promise.all([
      Comment.deleteMany({ _id: { $in: ids } }),
      Like.deleteMany({ targetKind: "Comment", target: { $in: ids } }),
    ]);
    await repairPostCounts(postIds);
    return { updated: docs.length };
  }
  const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : "spam";
  const res = await Comment.updateMany({ _id: { $in: ids } }, { status });
  return { updated: res.modifiedCount };
}

/* --------------------------------- media --------------------------------- */

export async function listMedia(filter: {
  page: number;
  limit: number;
  usage?: string;
  search?: string;
  format?: string;
}) {
  const query: Record<string, unknown> = {};
  if (filter.usage) query["usage"] = filter.usage;
  if (filter.format) query["format"] = filter.format;
  if (filter.search) {
    const rx = { $regex: escapeRegExp(filter.search), $options: "i" };
    query["$or"] = [{ publicId: rx }, { alt: rx }, { folder: rx }, { format: rx }];
  }
  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    Media.find(query)
      .select("url publicId resourceType format width height bytes alt usage folder createdAt owner post")
      .populate("owner", "name email")
      .populate("post", "title slug")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit)
      .lean(),
    Media.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit };
}

/** Delete registry row + best-effort Cloudinary destroy (never 500s on it). */
export async function deleteMedia(id: string) {
  const doc = await Media.findById(id).select("publicId resourceType").lean();
  if (!doc) throw new ApiError(404, "Media not found");
  await Media.deleteOne({ _id: id });
  try {
    await cloudinary.uploader.destroy(doc.publicId, {
      resource_type: (doc.resourceType ?? "image") as "image" | "video" | "raw",
    });
  } catch {
    // bytes orphaned on Cloudinary; registry is source of truth for the app
  }
  return { deleted: true };
}

/* ------------------------------- newsletter ------------------------------ */

export async function listSubscribers(filter: {
  page: number;
  limit: number;
  status?: string;
  search?: string;
}) {
  const query: Record<string, unknown> = {};
  if (filter.status) query["status"] = filter.status;
  if (filter.search) {
    const rx = { $regex: escapeRegExp(filter.search), $options: "i" };
    query["$or"] = [{ email: rx }, { name: rx }];
  }
  const skip = (filter.page - 1) * filter.limit;
  const [items, total, byStatus] = await Promise.all([
    NewsletterSubscriber.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(filter.limit)
      .lean(),
    NewsletterSubscriber.countDocuments(query),
    NewsletterSubscriber.aggregate<{ _id: string; n: number }>([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
  ]);
  const counts: Record<string, number> = {};
  for (const row of byStatus) counts[row._id] = row.n;
  return { items, total, counts, page: filter.page, limit: filter.limit };
}

export async function deleteSubscriber(id: string) {
  const res = await NewsletterSubscriber.deleteOne({ _id: id });
  if (res.deletedCount === 0) throw new ApiError(404, "Subscriber not found");
  return { deleted: true };
}

/* -------------------------------- settings ------------------------------- */

export async function getSettings() {
  const doc =
    (await SiteSettings.findOne({ key: "site" }).lean()) ??
    (await SiteSettings.create({ key: "site" })).toObject();
  return doc;
}

export async function updateSettings(patch: Record<string, unknown>) {
  const doc = await SiteSettings.findOneAndUpdate(
    { key: "site" },
    { $set: patch },
    { new: true, runValidators: true, upsert: true },
  ).lean();
  if (!doc) throw new ApiError(500, "Could not save settings");
  return doc;
}

/* -------------------------------- analytics ------------------------------ */

/** Day strings for range, ascending — shared x-axis for all series. */
function dayRange(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function customDayRange(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

async function seriesByDay(
  model: {
    aggregate<R>(pipeline?: PipelineStage[]): Promise<R[]>;
  },
  field: string,
  since: Date,
  extraMatch: Record<string, unknown> = {},
): Promise<Record<string, number>> {
  const rows = await model.aggregate<{ _id: string; n: number }>([
    { $match: { [field]: { $gte: since }, ...extraMatch } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: `$${field}` } },
        n: { $sum: 1 },
      },
    },
  ]);
  const map: Record<string, number> = {};
  for (const r of rows) map[r._id] = r.n;
  return map;
}

// Simple in-memory cache 60s to avoid DB hammer on dashboard poll
const analyticsCache = new Map<string, { data: unknown; exp: number }>();
function cacheGet(key: string): unknown | null {
  const v = analyticsCache.get(key);
  if (!v) return null;
  if (Date.now() > v.exp) {
    analyticsCache.delete(key);
    return null;
  }
  return v.data;
}
function cacheSet(key: string, data: unknown, ttlMs = 60000) {
  analyticsCache.set(key, { data, exp: Date.now() + ttlMs });
}

/** Enhanced analytics: today/7/30/90/custom, unique visitors, popular posts, traffic trends. */
export async function getAnalytics(
  input: number | { days?: number; start?: string; end?: string },
): Promise<{
  days: string[];
  views: number[];
  uniqueVisitors: number[];
  posts: number[];
  users: number[];
  engagement: { likes: number[]; bookmarks: number[]; comments: number[] };
  totals: { views: number; uniqueVisitors: number; likes: number; bookmarks: number; comments: number };
  popular: Array<{ _id: string; title: string; slug: string; views: number; likes: number }>;
}> {
  const opts = typeof input === "number" ? { days: input as 1 | 7 | 30 | 90 } : input;
  const hasCustom = !!(opts as { start?: string }).start;
  const labels = hasCustom
    ? customDayRange((opts as { start: string }).start, (opts as { end: string }).end)
    : dayRange((opts as { days?: number }).days ?? 30);
  const cacheKey = hasCustom
    ? `analytics:custom:${labels[0]}:${labels[labels.length - 1]}`
    : `analytics:days:${labels.length}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached as never;

  const since = new Date(labels[0] + "T00:00:00.000Z");
  const until = new Date(labels[labels.length - 1] + "T23:59:59.999Z");

  // Parallel aggregations — all use indexed fields (day, createdAt)
  const [viewRows, uniqueRows, posts, users, likes, bookmarks, comments, popular] = await Promise.all([
    PostView.aggregate<{ _id: string; n: number }>([
      { $match: { day: { $gte: labels[0], $lte: labels[labels.length - 1] } } },
      { $group: { _id: "$day", n: { $sum: 1 } } },
    ]),
    // Unique visitors per day: distinct viewerHash
    PostView.aggregate<{ _id: string; n: number }>([
      { $match: { day: { $gte: labels[0], $lte: labels[labels.length - 1] } } },
      { $group: { _id: { day: "$day", viewer: "$viewerHash" } } },
      { $group: { _id: "$_id.day", n: { $sum: 1 } } },
    ]),
    seriesByDay(Post, "createdAt", since),
    seriesByDay(User, "createdAt", since),
    seriesByDay(Like, "createdAt", since, { targetKind: "Post" }),
    seriesByDay(Bookmark, "createdAt", since),
    seriesByDay(Comment, "createdAt", since, { status: "approved" }),
    // Popular posts in range: by views then likes, privacy-safe (no personal data)
    Post.aggregate<{ _id: string; title: string; slug: string; views: number; likes: number }>([
      { $match: { status: "published", publishedAt: { $gte: since, $lte: until } } },
      { $sort: { views: -1, likeCount: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, _id2: "$_id", title: 1, slug: 1, views: 1, likes: "$likeCount" } },
      { $addFields: { _id: { $toString: "$_id2" } } },
      { $project: { _id2: 0 } },
    ]),
  ]);

  const viewMap: Record<string, number> = {};
  for (const r of viewRows) viewMap[r._id] = r.n;
  const uniqMap: Record<string, number> = {};
  for (const r of uniqueRows) uniqMap[r._id] = r.n;
  const at = (m: Record<string, number>) => labels.map((d) => m[d] ?? 0);

  const viewsArr = at(viewMap);
  const uniqArr = at(uniqMap);

  const result = {
    days: labels,
    views: viewsArr,
    uniqueVisitors: uniqArr,
    posts: at(posts),
    users: at(users),
    engagement: { likes: at(likes), bookmarks: at(bookmarks), comments: at(comments) },
    totals: {
      views: viewsArr.reduce((a, b) => a + b, 0),
      uniqueVisitors: uniqArr.reduce((a, b) => a + b, 0),
      likes: at(likes).reduce((a, b) => a + b, 0),
      bookmarks: at(bookmarks).reduce((a, b) => a + b, 0),
      comments: at(comments).reduce((a, b) => a + b, 0),
    },
    popular: popular.map((p) => ({ _id: p._id, title: p.title, slug: p.slug, views: p.views, likes: p.likes })),
  };
  cacheSet(cacheKey, result);
  return result;
}
