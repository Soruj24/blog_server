import { User, USER_ROLES, USER_STATUSES } from "../models/User.js";
import { Profile } from "../models/Profile.js";
import { Bookmark } from "../models/Bookmark.js";
import { Notification } from "../models/Notification.js";
import { Post } from "../models/Post.js";
import { ApiError } from "../utils/ApiError.js";
import { stripHtml } from "../utils/sanitize.js";
import { attachProfiles } from "./article.service.js";
import type {
  UpdateMeInput,
  UpdateProfileInput,
} from "../validations/user.validation.js";

/** Own account view: identity + public profile in one round-trip. */
export async function getMe(userId: string) {  const [user, profile] = await Promise.all([
    User.findById(userId),
    Profile.findOne({ user: userId }),
  ]);
  if (!user) throw new ApiError(404, "User not found");
  return { user, profile };
}

/** PATCH /users/me — identity fields only. Role/status change is admin-only. */
export async function updateMe(userId: string, input: UpdateMeInput) {
  if (input.name) input.name = stripHtml(input.name).trim();
  if (input.image) input.image = stripHtml(input.image).trim();
  const user = await User.findByIdAndUpdate(userId, input, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

/** PATCH /users/me/profile — public author page. */
export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (typeof v === "string") sanitized[k] = stripHtml(v).trim();
    else sanitized[k] = v;
  }
  const profile = await Profile.findOneAndUpdate({ user: userId }, sanitized, {
    new: true,
    runValidators: true,
  });
  if (!profile) throw new ApiError(404, "Profile not found");
  return profile;
}

/** Public profile page: username → profile + minimal author info. */
export async function getByUsername(username: string) {
  const profile = await Profile.findOne({ username }).populate("user", "name image role createdAt");
  if (!profile) throw new ApiError(404, "Profile not found");
  return profile;
}

export async function getById(id: string) {
  const [user, profile] = await Promise.all([
    User.findById(id),
    Profile.findOne({ user: id }),
  ]);
  if (!user) throw new ApiError(404, "User not found");
  return { user, profile };
}

interface ListUsersFilter {
  page: number;
  limit: number;
  role?: (typeof USER_ROLES)[number];
  status?: "active" | "suspended";
  search?: string;
}

/** Admin user table: page pagination + role/status/search filters. */
export async function listUsers(filter: ListUsersFilter) {
  const query: Record<string, unknown> = {};
  if (filter.role) query["role"] = filter.role;
  if (filter.status) query["status"] = filter.status;
  if (filter.search) {
    const esc = filter.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query["$or"] = [
      { name: { $regex: esc, $options: "i" } },
      { email: { $regex: esc, $options: "i" } },
    ];
  }
  const skip = (filter.page - 1) * filter.limit;
  const [items, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(filter.limit).lean(),
    User.countDocuments(query),
  ]);
  return { items, total, page: filter.page, limit: filter.limit };
}

/** Admin: role/status transitions. Last-admin demotion is refused. */
export async function adminUpdateUser(
  id: string,
  input: { role?: (typeof USER_ROLES)[number]; status?: (typeof USER_STATUSES)[number] },
) {
  if (input.role !== "admin") {
    const target = await User.findById(id).select("role");
    if (target?.role === "admin") {
      const adminCount = await User.countDocuments({ role: "admin" });
      if (adminCount <= 1) throw new ApiError(400, "Cannot demote the last admin");
    }
  }
  const user = await User.findByIdAndUpdate(id, input, {
    new: true,
    runValidators: true,
  });
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

/** Public author leaderboard — writers with published work, by output then followers. */
export async function getPopularAuthors(limit: number) {
  return Profile.find({ postCount: { $gt: 0 } })
    .select("username displayName bio avatarUrl postCount followerCount")
    .populate("user", "name image")
    .sort({ postCount: -1, followerCount: -1 })
    .limit(limit)
    .lean();
}

/** Own reading list: bookmarked posts newest-saved first.
 *  Unpublished/deleted posts drop out silently (stale refs, not errors). */
export async function listMyBookmarks(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [edges, total] = await Promise.all([
    Bookmark.find({ user: userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Bookmark.countDocuments({ user: userId }),
  ]);
  const postIds = edges.map((e) => e.post);
  const posts = postIds.length
    ? await Post.find({
        _id: { $in: postIds },
        status: "published",
        visibility: "public",
      })
        .select("-content -seoTitle -seoDescription -canonicalUrl -ogImage")
        .populate("author", "name image")
        .populate("category", "name slug color")
        .populate("tags", "name slug")
        .lean()
    : [];
  const shaped = await attachProfiles(
    posts as unknown as Parameters<typeof attachProfiles>[0],
  );
  const byId = new Map(shaped.map((p) => [p.id, p]));
  // Preserve save order (newest first), skipping vanished posts.
  const items = edges
    .map((e) => byId.get(String(e.post)))
    .filter((p): p is NonNullable<typeof p> => !!p);
  return { items, total, page, limit };
}

/** Dashboard bundle: profile counters + totals for one screen, one call. */
export async function getMyStats(userId: string) {
  const profile = await Profile.findOne({ user: userId })
    .select("username displayName postCount followerCount followingCount")
    .lean();
  if (!profile) throw new ApiError(404, "Profile not found");
  const [bookmarksCount, unreadCount, viewsAgg] = await Promise.all([
    Bookmark.countDocuments({ user: userId }),
    Notification.countDocuments({ recipient: userId, isRead: false }),
    Post.aggregate<{ total: number }>([
      { $match: { author: profile.user, status: "published" } },
      { $group: { _id: null, total: { $sum: "$views" } } },
    ]),
  ]);
  return {
    username: profile.username,
    displayName: profile.displayName,
    postCount: profile.postCount,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    totalViews: viewsAgg[0]?.total ?? 0,
    bookmarksCount,
    unreadCount,
  };
}

/** Admin bulk suspend/activate. Suspending every active admin is refused. */
export async function adminBulkUserStatus(ids: string[], status: "active" | "suspended") {
  if (status === "suspended") {
    const remaining = await User.countDocuments({
      role: "admin",
      status: "active",
      _id: { $nin: ids },
    });
    if (remaining === 0) {
      const affected = await User.countDocuments({ _id: { $in: ids }, role: "admin" });
      if (affected > 0) throw new ApiError(400, "Cannot suspend the last active admin");
    }
  }
  const res = await User.updateMany({ _id: { $in: ids } }, { status });
  return { updated: res.modifiedCount };
}
