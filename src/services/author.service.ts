import { Post } from "../models/Post.js";
import { Profile } from "../models/Profile.js";
import { ApiError } from "../utils/ApiError.js";

export interface AuthorProfile {
  username: string;
  displayName: string;
  title: string;
  expertise: string[];
  bio: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  website: string | null;
  twitter: string | null;
  github: string | null;
  linkedin: string | null;
  location: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  totalViews: number;
  joinedAt: string | null;
  name: string;
}

/**
 * Public author profile — explicit allowlist shaping, never leaks email
 * or auth internals. totalViews aggregates published-post counters
 * (cheap: single $group over the author's posts).
 */
export async function getAuthorProfile(username: string): Promise<AuthorProfile> {
  const profile = await Profile.findOne({ username: username.toLowerCase() })
    .populate("user", "name image createdAt")
    .lean();
  if (!profile || !profile.user) throw new ApiError(404, "Author not found");

  const user = profile.user as unknown as {
    _id: unknown;
    name: string;
    image?: string | null;
    createdAt?: Date;
  };

  const views = await Post.aggregate<{ total: number }>([
    { $match: { author: user._id, status: "published" } },
    { $group: { _id: null, total: { $sum: "$views" } } },
  ]);

  return {
    username: profile.username,
    displayName: profile.displayName,
    title: profile.title ?? "",
    expertise: profile.expertise ?? [],
    bio: profile.bio ?? "",
    avatarUrl: profile.avatarUrl ?? user.image ?? null,
    coverUrl: profile.coverUrl ?? null,
    website: profile.website ?? null,
    twitter: profile.twitter ?? null,
    github: profile.github ?? null,
    linkedin: profile.linkedin ?? null,
    location: profile.location ?? null,
    followerCount: profile.followerCount,
    followingCount: profile.followingCount,
    postCount: profile.postCount,
    totalViews: views[0]?.total ?? 0,
    joinedAt: user.createdAt ? user.createdAt.toISOString() : null,
    name: profile.displayName || user.name,
  };
}

export interface DirectoryAuthor {
  username: string;
  displayName: string;
  title: string;
  expertise: string[];
  bio: string;
  avatarUrl: string | null;
  location: string | null;
  followerCount: number;
  postCount: number;
}

/**
 * Public author directory — every profile, including writers with zero
 * published posts (unlike the popular leaderboard). Sorted by output,
 * then followers. Paginated; limit capped by validation (max 50).
 */
export async function listAuthors(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Profile.find({})
      .select(
        "username displayName title expertise bio avatarUrl location followerCount postCount",
      )
      .sort({ postCount: -1, followerCount: -1, displayName: 1 })
      .skip(skip)
      .limit(limit)
      .lean<DirectoryAuthor[]>(),
    Profile.countDocuments({}),
  ]);
  return {
    items: items.map((a) => ({
      ...a,
      title: a.title ?? "",
      expertise: a.expertise ?? [],
      bio: a.bio ?? "",
    })),
    total,
    page,
    limit,
  };
}
