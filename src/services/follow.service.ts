import { Follow } from "../models/Follow.js";
import { Profile } from "../models/Profile.js";
import { ApiError } from "../utils/ApiError.js";
import { actorDisplayName, notify } from "./notification.service.js";

/** Resolve a username to its user id (404 for unknown authors). */
async function targetUserId(username: string): Promise<string> {
  const profile = await Profile.findOne({ username: username.toLowerCase() }).select("user");
  if (!profile) throw new ApiError(404, "Author not found");
  return String(profile.user);
}

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/** Toggle follow. Counters mirror edges; races resolve to current state. */
export async function toggleFollow(followerId: string, username: string) {
  const followingId = await targetUserId(username);
  if (followingId === followerId) throw new ApiError(400, "You cannot follow yourself");

  const existing = await Follow.findOne({ follower: followerId, following: followingId }).select("_id");
  if (existing) {
    await Follow.deleteOne({ _id: existing._id });
    await Profile.updateOne({ user: followingId }, { $inc: { followerCount: -1 } });
    await Profile.updateOne({ user: followerId }, { $inc: { followingCount: -1 } });
    const target = await Profile.findOne({ user: followingId }).select("followerCount").lean();
    return { following: false, followerCount: Math.max(0, target?.followerCount ?? 0) };
  }
  try {
    await Follow.create({ follower: followerId, following: followingId });
  } catch (err) {
    if (!isDuplicateKey(err)) throw err;
  }
  await Profile.updateOne({ user: followingId }, { $inc: { followerCount: 1 } });
  await Profile.updateOne({ user: followerId }, { $inc: { followingCount: 1 } });
  const target = await Profile.findOne({ user: followingId }).select("followerCount").lean();
  const name = await actorDisplayName(followerId);
  await notify({
    recipient: followingId,
    actor: followerId,
    type: "follow",
    title: `${name} started following you`,
  });
  return { following: true, followerCount: target?.followerCount ?? 1 };
}

/** Whether the current user follows this author. */
export async function followState(followerId: string, username: string) {
  const followingId = await targetUserId(username);
  const edge = await Follow.exists({ follower: followerId, following: followingId });
  return { following: !!edge };
}
