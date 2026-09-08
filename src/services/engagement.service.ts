import crypto from "node:crypto";
import { Bookmark } from "../models/Bookmark.js";
import { Comment, REPORT_THRESHOLD } from "../models/Comment.js";
import { Like } from "../models/Like.js";
import { Post } from "../models/Post.js";
import { PostView } from "../models/PostView.js";
import { Profile } from "../models/Profile.js";
import { ApiError } from "../utils/ApiError.js";
import { sanitizeText } from "../utils/sanitize.js";
import { attachProfiles, publishedFilter } from "./article.service.js";
import { actorDisplayName, notify } from "./notification.service.js";

/** Published post id or 404 (drafts/scheduled/deleted never engageable). */
async function publishedPostId(slug: string) {
  const post = await Post.findOne({ ...publishedFilter(), slug }).select("_id");
  if (!post) throw new ApiError(404, "Article not found");
  return post._id;
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/** Toggle post like. Duplicate-key races resolve to current state, never 500. */
export async function toggleLike(userId: string, slug: string) {
  const postId = await publishedPostId(slug);
  const existing = await Like.findOne({ user: userId, targetKind: "Post", target: postId }).select("_id");
  if (existing) {
    await Like.deleteOne({ _id: existing._id });
    await Post.updateOne({ _id: postId }, { $inc: { likeCount: -1 } });
    const post = await Post.findById(postId).select("likeCount").lean();
    return { liked: false, likeCount: Math.max(0, post?.likeCount ?? 0) };
  }
  try {
    await Like.create({ user: userId, targetKind: "Post", target: postId });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  const post = await Post.findByIdAndUpdate(
    postId,
    { $inc: { likeCount: 1 } },
    { returnDocument: "after" },
  )
    .select("likeCount author title slug")
    .lean();
  const likeCount = post?.likeCount ?? 1;
  // Notify the author (best-effort, never fails the like itself).
  if (post) {
    const name = await actorDisplayName(userId);
    await notify({
      recipient: post.author,
      actor: userId,
      type: "like",
      title: `${name} liked your article`,
      body: String(post.title).slice(0, 200),
      post: postId,
    });
  }
  return { liked: true, likeCount };
}

/** Toggle bookmark (optional folder). Same race-safe pattern as likes. */
export async function toggleBookmark(userId: string, slug: string, folder?: string) {
  const postId = await publishedPostId(slug);
  const existing = await Bookmark.findOne({ user: userId, post: postId }).select("_id");
  if (existing) {
    await Bookmark.deleteOne({ _id: existing._id });
    await Post.updateOne({ _id: postId }, { $inc: { bookmarkCount: -1 } });
    const post = await Post.findById(postId).select("bookmarkCount").lean();
    return { bookmarked: false, bookmarkCount: Math.max(0, post?.bookmarkCount ?? 0) };
  }
  try {
    await Bookmark.create({ user: userId, post: postId, ...(folder ? { folder } : {}) });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  const post = await Post.findByIdAndUpdate(
    postId,
    { $inc: { bookmarkCount: 1 } },
    { returnDocument: "after" },
  )
    .select("bookmarkCount author title")
    .lean<{ bookmarkCount: number; author: unknown; title: string } | null>();
  // Notify author of bookmark
  if (post) {
    const name = await actorDisplayName(userId);
    await notify({
      recipient: (post as { author: unknown }).author,
      actor: userId,
      type: "bookmark",
      title: `${name} bookmarked your article`,
      body: String((post as { title: string }).title).slice(0, 200),
      post: postId,
    });
  }
  return { bookmarked: true, bookmarkCount: post?.bookmarkCount ?? 1 };
}

/** Current user's like/bookmark flags for one article. */
export async function engagementState(userId: string, slug: string) {
  const postId = await publishedPostId(slug);
  const [like, bookmark] = await Promise.all([
    Like.exists({ user: userId, targetKind: "Post", target: postId }),
    Bookmark.exists({ user: userId, post: postId }),
  ]);
  return { liked: !!like, bookmarked: !!bookmark };
}

export interface ShapedComment {
  id: string;
  content: string;
  likeCount: number;
  replyCount: number;
  createdAt: Date | null;
  author: { name: string; username: string; avatarUrl: string | null } | null;
  /** Raw author id for client-side ownership checks (server re-checks). */
  authorId: string | null;
  status: string;
  isEdited: boolean;
  editedAt: Date | null;
  isDeleted: boolean;
  liked: boolean;
  flagCount: number;
  replies: ShapedComment[];
}

interface CommentLean {
  _id: unknown;
  content: string;
  likeCount: number;
  replyCount: number;
  createdAt?: Date;
  parent?: unknown;
  author?: { _id: unknown; name: string; image?: string | null } | null;
  authorId?: unknown;
  status?: string;
  isEdited?: boolean;
  editedAt?: Date | null;
  isDeleted?: boolean;
  flagCount?: number;
}

/** Shapes comments + author profiles in one batched lookup.
 *  Tombstones (isDeleted) render as "[deleted]" with no author. */
async function shapeComments(
  docs: CommentLean[],
  likedIds: Set<string> = new Set(),
): Promise<ShapedComment[]> {
  const authorIds = docs.flatMap((c) => {
    const raw = c.authorId ?? c.author?._id;
    return raw ? [String(raw)] : [];
  });
  const profiles = authorIds.length
    ? await Profile.find({ user: { $in: authorIds } })
        .select("user username displayName avatarUrl")
        .lean()
    : [];
  const byUser = new Map(profiles.map((p) => [String(p.user), p]));
  return docs.map((c) => {
    const rawAuthor = c.authorId ?? c.author?._id;
    const authorId = rawAuthor ? String(rawAuthor) : null;
    const deleted = !!c.isDeleted;
    return {
      id: String(c._id),
      content: deleted ? "[deleted]" : c.content,
      likeCount: c.likeCount,
      replyCount: c.replyCount,
      createdAt: c.createdAt ?? null,
      author:
        deleted || !c.author
          ? null
          : {
              name: byUser.get(String(c.author._id))?.displayName ?? c.author.name,
              username: byUser.get(String(c.author._id))?.username ?? "",
              avatarUrl: byUser.get(String(c.author._id))?.avatarUrl ?? c.author.image ?? null,
            },
      authorId: deleted ? null : authorId,
      status: c.status ?? "approved",
      isEdited: !!c.isEdited,
      editedAt: c.editedAt ?? null,
      isDeleted: deleted,
      liked: likedIds.has(String(c._id)),
      flagCount: c.flagCount ?? 0,
      replies: [],
    };
  });
}

export interface CommentViewer {
  id: string;
  role?: string;
}

function isModerator(role?: string): boolean {
  return role === "admin" || role === "editor";
}

/** Thread view: top-level oldest-first + their replies.
 *  Public sees approved (+ own pending for the author). Moderators may
 *  pass filter "pending" (review queue) or "all". */
export async function listComments(
  slug: string,
  page: number,
  limit: number,
  viewer?: CommentViewer,
  filter?: "pending" | "all",
) {
  const postId = await publishedPostId(slug);
  const mod = isModerator(viewer?.role);
  if (filter && !mod) throw new ApiError(403, "Moderator role required");

  let statusMatch: Record<string, unknown>;
  if (filter === "all" && mod) {
    statusMatch = { status: { $in: ["pending", "approved", "rejected", "spam"] } };
  } else if (filter === "pending" && mod) {
    statusMatch = { status: "pending" };
  } else if (viewer) {
    statusMatch = {
      $or: [{ status: "approved" }, { status: "pending", author: viewer.id }],
    };
  } else {
    statusMatch = { status: "approved" };
  }

  const skip = (page - 1) * limit;
  const base = { post: postId, parent: null, ...statusMatch };
  const [tops, total, pendingCount] = await Promise.all([
    Comment.find(base)
      .populate("author", "name image")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean<CommentLean[]>(),
    Comment.countDocuments(base),
    Comment.countDocuments({ post: postId, status: "pending" }),
  ]);
  const topIds = tops.map((t) => String(t._id));
  const replies = topIds.length
    ? await Comment.find({ post: postId, parent: { $in: topIds }, ...statusMatch })
        .populate("author", "name image")
        .sort({ createdAt: 1 })
        .lean<CommentLean[]>()
    : [];
  const likedIds = await likedCommentIds(
    viewer?.id,
    [...tops, ...replies].map((c) => String(c._id)),
  );
  const [shapedTops, shapedReplies] = await Promise.all([
    shapeComments(tops, likedIds),
    shapeComments(replies, likedIds),
  ]);
  const byParent = new Map<string, ShapedComment[]>();
  replies.forEach((r, i) => {
    const pid = String(r.parent);
    const list = byParent.get(pid) ?? [];
    const shaped = shapedReplies[i];
    if (shaped) list.push(shaped);
    byParent.set(pid, list);
  });
  const items = shapedTops.map((t) => ({ ...t, replies: byParent.get(t.id) ?? [] }));
  return { items, total, pendingCount, page, limit };
}

/** Liked flags for one viewer across a page of comments (single query). */
async function likedCommentIds(userId: string | undefined, ids: string[]): Promise<Set<string>> {
  if (!userId || ids.length === 0) return new Set();
  const likes = await Like.find({ user: userId, targetKind: "Comment", target: { $in: ids } })
    .select("target")
    .lean();
  return new Set(likes.map((l) => String(l.target)));
}

/** Create comment or one-level reply. Counters maintained here, not by clients.
 *  Markup is stripped server-side (stored comments are plain text);
 *  markup-only bodies are rejected after sanitization. */
export async function addComment(userId: string, slug: string, content: string, parentId?: string) {
  const postId = await publishedPostId(slug);
  const clean = sanitizeText(content, 2000);
  if (!clean) throw new ApiError(400, "Comment cannot be empty");
  let parent: { _id: unknown; author?: unknown } | null = null;
  if (parentId) {
    parent = await Comment.findOne({ _id: parentId, post: postId }).select("_id parent author").lean();
    if (!parent) throw new ApiError(404, "Parent comment not found");
    if ((parent as { parent?: unknown }).parent) {
      throw new ApiError(400, "Replies nest one level only");
    }
  }
  const created = await Comment.create({
    post: postId,
    author: userId,
    content: clean,
    status: "approved",
    ...(parent ? { parent: parent._id } : {}),
  });
  await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
  if (parent) {
    await Comment.updateOne({ _id: parent._id }, { $inc: { replyCount: 1 } });
  }
  const [shaped] = await shapeComments([
    {
      _id: created._id,
      content: created.content,
      likeCount: 0,
      replyCount: 0,
      createdAt: created.createdAt,
      author: undefined,
    },
  ]);
  if (!shaped) throw new ApiError(500, "Could not load comment");
  // Attach the author's own profile for an instant, correct render.
  const profile = await Profile.findOne({ user: userId })
    .select("username displayName avatarUrl")
    .lean();
  // Notify post owner (or parent author for replies) — best-effort.
  const postMeta = await Post.findById(postId).select("author title slug").lean();
  if (postMeta) {
    const name = profile?.displayName ?? "Someone";
    const snippet = created.content.slice(0, 200);
    if (parent?.author) {
      await notify({
        recipient: parent.author,
        actor: userId,
        type: "reply",
        title: `${name} replied to your comment`,
        body: snippet,
        post: postId,
        comment: created._id,
      });
    } else {
      await notify({
        recipient: postMeta.author,
        actor: userId,
        type: "comment",
        title: `${name} commented on your article`,
        body: snippet,
        post: postId,
        comment: created._id,
      });
    }
  }
  return {
    ...shaped,
    author: profile
      ? { name: profile.displayName, username: profile.username, avatarUrl: profile.avatarUrl ?? null }
      : shaped.author,
    authorId: String(userId),
  };
}

/** Load one comment scoped to its post (404 covers wrong-post ids too). */
async function commentInPost(slug: string, id: string) {
  const postId = await publishedPostId(slug);
  const comment = await Comment.findOne({ _id: id, post: postId });
  if (!comment) throw new ApiError(404, "Comment not found");
  return { comment, postId };
}

function isOwner(comment: { author: unknown }, userId: string): boolean {
  return String(comment.author) === String(userId);
}

/** Edit own comment. Moderators use moderation tools, never rewrite users. */
export async function updateComment(userId: string, slug: string, id: string, content: string) {
  const { comment } = await commentInPost(slug, id);
  if (!isOwner(comment, userId)) throw new ApiError(403, "You can only edit your own comments");
  if (comment.isDeleted) throw new ApiError(400, "Deleted comments cannot be edited");
  const clean = sanitizeText(content, 2000);
  if (!clean) throw new ApiError(400, "Comment cannot be empty");
  comment.content = clean;
  comment.isEdited = true;
  comment.editedAt = new Date();
  await comment.save();
  const [shaped] = await shapeComments([
    {
      _id: comment._id,
      content: comment.content,
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      createdAt: comment.createdAt,
      status: comment.status,
      isEdited: true,
      editedAt: comment.editedAt ?? undefined,
      isDeleted: false,
      flagCount: comment.flagCount,
      authorId: userId,
    },
  ]);
  if (!shaped) throw new ApiError(500, "Could not load comment");
  const profile = await Profile.findOne({ user: userId })
    .select("username displayName avatarUrl")
    .lean();
  return {
    ...shaped,
    author: profile
      ? { name: profile.displayName, username: profile.username, avatarUrl: profile.avatarUrl ?? null }
      : shaped.author,
  };
}

/** Delete own (or any, for moderators) comment.
 *  Threads with replies become tombstones; childless comments hard-delete
 *  with counter repair. */
export async function deleteComment(
  userId: string,
  slug: string,
  id: string,
  userRole?: string,
) {
  const { comment, postId } = await commentInPost(slug, id);
  const mod = userRole === "admin" || userRole === "editor";
  if (!mod && !isOwner(comment, userId)) {
    throw new ApiError(403, "You can only delete your own comments");
  }
  const children = await Comment.countDocuments({ parent: comment._id });
  if (children > 0) {
    comment.isDeleted = true;
    comment.content = "[deleted]";
    await comment.save();
    return { deleted: true, tombstoned: true };
  }
  const wasCounted = comment.status === "approved" && !comment.isDeleted;
  await Comment.deleteOne({ _id: comment._id });
  await Like.deleteMany({ targetKind: "Comment", target: comment._id });
  if (wasCounted) {
    await Post.updateOne({ _id: postId }, { $inc: { commentCount: -1 } });
    if (comment.parent) {
      await Comment.updateOne({ _id: comment.parent }, { $inc: { replyCount: -1 } });
    }
  }
  return { deleted: true, tombstoned: false };
}

/** Report a comment. One report per user; threshold auto-queues for review.
 *  Reports never reveal other reporters. */
export async function reportComment(
  userId: string,
  slug: string,
  id: string,
  reason: string,
) {
  const { comment } = await commentInPost(slug, id);
  if (isOwner(comment, userId)) throw new ApiError(400, "You cannot report your own comment");
  if (comment.reports.some((r: { user: unknown }) => String(r.user) === String(userId))) {
    throw new ApiError(409, "You already reported this comment");
  }
  comment.reports.push({ user: userId, reason } as never);
  comment.flagCount += 1;
  if (comment.flagCount >= REPORT_THRESHOLD && comment.status === "approved") {
    comment.status = "pending";
  }
  await comment.save();
  return { flagCount: comment.flagCount, status: comment.status };
}

/** Toggle like on a visible comment (approved or own pending). */
export async function toggleCommentLike(userId: string, slug: string, id: string) {
  const { comment } = await commentInPost(slug, id);
  if (comment.isDeleted) throw new ApiError(400, "Deleted comments cannot be liked");
  if (comment.status === "rejected" || comment.status === "spam") {
    throw new ApiError(400, "This comment is not available for likes");
  }
  const existing = await Like.findOne({ user: userId, targetKind: "Comment", target: comment._id }).select(
    "_id",
  );
  if (existing) {
    await Like.deleteOne({ _id: existing._id });
    await Comment.updateOne({ _id: comment._id }, { $inc: { likeCount: -1 } });
    const fresh = await Comment.findById(comment._id).select("likeCount").lean();
    return { liked: false, likeCount: Math.max(0, fresh?.likeCount ?? 0) };
  }
  try {
    await Like.create({ user: userId, targetKind: "Comment", target: comment._id });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  const fresh = await Comment.findByIdAndUpdate(
    comment._id,
    { $inc: { likeCount: 1 } },
    { returnDocument: "after" },
  )
    .select("likeCount")
    .lean();
  return { liked: true, likeCount: fresh?.likeCount ?? 1 };
}

/** Moderate: approve / reject / mark spam. Counters follow the approved
 *  boundary in both directions so feeds stay exact. */
export async function moderateComment(slug: string, id: string, status: "approved" | "rejected" | "spam") {
  const { comment, postId } = await commentInPost(slug, id);
  const previousStatus = comment.status;
  const wasCounted = comment.status === "approved" && !comment.isDeleted;
  const nowCounted = status === "approved" && !comment.isDeleted;
  comment.status = status;
  await comment.save();
  if (wasCounted !== nowCounted) {
    const delta = nowCounted ? 1 : -1;
    await Post.updateOne({ _id: postId }, { $inc: { commentCount: delta } });
    if (comment.parent) {
      await Comment.updateOne({ _id: comment.parent }, { $inc: { replyCount: delta } });
    }
  }
  // Notify author when approved
  if (status === "approved" && previousStatus !== "approved") {
    const postMeta = await Post.findById(postId).select("title").lean();
    await notify({
      recipient: comment.author,
      type: "approved",
      title: "Your comment was approved",
      body: (postMeta?.title ?? "Your comment").slice(0, 200),
      post: postId,
      comment: comment._id,
    });
  }
  const [shaped] = await shapeComments([
    {
      _id: comment._id,
      content: comment.content,
      likeCount: comment.likeCount,
      replyCount: comment.replyCount,
      createdAt: comment.createdAt,
      status: comment.status,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt ?? undefined,
      isDeleted: comment.isDeleted,
      flagCount: comment.flagCount,
      authorId: comment.author,
    },
  ]);
  if (!shaped) throw new ApiError(500, "Could not load comment");
  return shaped;
}

/**
 * View tracking — counted at most once per viewer per day:
 * - viewerHash = sha256(viewerId + day); raw ids never stored.
 * - Unique {post, viewerHash, day} absorbs refresh/retry storms at the DB.
 * - Post.views increments ONLY on successful insert.
 */
export async function trackView(slug: string, viewerId: string, referrer?: string) {
  const postId = await publishedPostId(slug);
  const day = new Date().toISOString().slice(0, 10);
  const viewerHash = crypto.createHash("sha256").update(`${viewerId}:${day}`).digest("hex");
  try {
    await PostView.create({
      post: postId,
      viewerHash,
      day,
      ...(referrer ? { referrer: referrer.slice(0, 1024) } : {}),
    });
  } catch (err) {
    if (isDuplicateKey(err)) return { counted: false };
    throw err;
  }
  await Post.updateOne({ _id: postId }, { $inc: { views: 1 } });
  return { counted: true };
}

/** Related: same category first, then shared tags, never self. */
export async function relatedPosts(slug: string, limit: number) {
  const current = await Post.findOne({ ...publishedFilter(), slug })
    .select("_id category tags")
    .lean<{ _id: unknown; category?: unknown; tags?: unknown[] } | null>();
  if (!current) throw new ApiError(404, "Article not found");

  const baseSelect = "-content -seoTitle -seoDescription -canonicalUrl -ogImage";
  const collected: Array<Record<string, unknown>> = [];
  const seen: unknown[] = [current._id];

  const fetchBatch = (extra: Record<string, unknown>, take: number) =>
    Post.find({ ...publishedFilter(), _id: { $nin: seen }, ...extra })
      .select(baseSelect)
      .populate("author", "name image")
      .populate("category", "name slug color")
      .populate("tags", "name slug")
      .sort({ publishedAt: -1 })
      .limit(take)
      .lean<Record<string, unknown>[]>();

  if (current.category) {
    const sameCat = await fetchBatch({ category: current.category }, limit);
    for (const d of sameCat) {
      collected.push(d);
      seen.push(d["_id"]);
    }
  }
  if (collected.length < limit && current.tags?.length) {
    const byTag = await fetchBatch({ tags: { $in: current.tags } }, limit - collected.length);
    collected.push(...byTag);
  }
  return attachProfiles(
    collected as unknown as Parameters<typeof attachProfiles>[0],
  );
}
