import { Notification, NOTIFICATION_TYPES } from "../models/Notification.js";
import { Profile } from "../models/Profile.js";
import { ApiError } from "../utils/ApiError.js";

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export async function actorDisplayName(userId: string): Promise<string> {
  const p = await Profile.findOne({ user: userId }).select("displayName").lean();
  return p?.displayName ?? "Someone";
}

interface NotifyInput {
  recipient: unknown;
  actor?: unknown;
  type: NotificationType;
  title: string;
  body?: string;
  post?: unknown;
  comment?: unknown;
}

/**
 * Best-effort notify — swallows its own errors (a notification must
 * never break the action that triggered it) and never self-notifies.
 * Also emits real-time via Socket.io if available.
 */
export async function notify(input: NotifyInput) {
  try {
    if (input.actor && String(input.actor) === String(input.recipient)) return null;
    const doc = await Notification.create({
      recipient: input.recipient,
      actor: input.actor ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      post: input.post ?? null,
      comment: input.comment ?? null,
    });
    // Real-time: lazy import to avoid circular
    try {
      const { emitNotification } = await import("../sockets/index.js");
      emitNotification(String(input.recipient), {
        id: String(doc._id),
        type: doc.type,
        title: doc.title,
        body: doc.body,
        isRead: doc.isRead,
        createdAt: doc.createdAt,
        actor: doc.actor,
        post: doc.post,
        comment: doc.comment,
      });
    } catch {
      // emit is best-effort
    }
    return doc;
  } catch {
    return null;
  }
}

/** Broadcast system/announcement to all users (admin only) */
export async function broadcastSystem(title: string, body?: string) {
  const { User } = await import("../models/User.js");
  const users = await User.find({}).select("_id").lean();
  if (users.length === 0) return { sent: 0 };
  const docs = users.map((u) => ({
    recipient: u._id,
    type: "system" as const,
    title,
    body: body ?? "",
  }));
  const created = await Notification.insertMany(docs, { ordered: false });
  // Emit to each
  try {
    const { emitNotification } = await import("../sockets/index.js");
    for (const doc of created) {
      emitNotification(String((doc as { recipient: unknown }).recipient), {
        id: String((doc as { _id: unknown })._id),
        type: "system",
        title,
        body: body ?? "",
        isRead: false,
        createdAt: new Date(),
      });
    }
  } catch {
    // best-effort
  }
  return { sent: created.length };
}

export async function notifyFollowersOfPost(authorId: string, postId: unknown, postTitle: string) {
  const { Follow } = await import("../models/Follow.js");
  const followers = await Follow.find({ following: authorId }).select("follower").lean();
  if (followers.length === 0) return;
  const name = await actorDisplayName(authorId);
  const title = `${name} published a new article`;
  for (const f of followers) {
    await notify({
      recipient: f.follower,
      actor: authorId,
      type: "publish",
      title,
      body: postTitle.slice(0, 200),
      post: postId,
    });
  }
}

interface ActorLean {
  _id: unknown;
  name: string;
  image?: string | null;
}

export interface ShapedNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: Date | null;
  actor: { name: string; username: string; avatarUrl: string | null } | null;
  post: { title: string; slug: string } | null;
}

/** Inbox: unread first, newest first — exactly the compound index order. */
export async function listNotifications(userId: string, page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [docs, total, unreadCount] = await Promise.all([
    Notification.find({ recipient: userId })
      .populate("actor", "name image")
      .populate("post", "title slug")
      .sort({ isRead: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ recipient: userId }),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  const actorIds = [
    ...new Set(
      (docs as Array<{ actor?: ActorLean | null }>)
        .flatMap((d) => (d.actor?._id ? [String(d.actor._id)] : [])),
    ),
  ];
  const profiles = actorIds.length
    ? await Profile.find({ user: { $in: actorIds } })
        .select("user username displayName avatarUrl")
        .lean()
    : [];
  const byUser = new Map(profiles.map((p) => [String(p.user), p]));

  const items: ShapedNotification[] = (
    docs as Array<{
      _id: unknown;
      type: string;
      title: string;
      body?: string;
      isRead: boolean;
      createdAt?: Date;
      actor?: ActorLean | null;
      post?: { title: string; slug: string } | null;
    }>
  ).map((d) => {
    const prof = d.actor ? byUser.get(String(d.actor._id)) : undefined;
    return {
      id: String(d._id),
      type: d.type,
      title: d.title,
      body: d.body ?? "",
      isRead: d.isRead,
      createdAt: d.createdAt ?? null,
      actor: d.actor
        ? {
            name: prof?.displayName ?? d.actor.name,
            username: prof?.username ?? "",
            avatarUrl: prof?.avatarUrl ?? d.actor.image ?? null,
          }
        : null,
      post: d.post ? { title: d.post.title, slug: d.post.slug } : null,
    };
  });

  return { items, total, unreadCount, page, limit };
}

/** Mark one owned notification read; read items age out via TTL. */
export async function markRead(userId: string, id: string) {
  const note = await Notification.findOne({ _id: id, recipient: userId });
  if (!note) throw new ApiError(404, "Notification not found");
  if (!note.isRead) {
    note.isRead = true;
    note.readAt = new Date();
    note.expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
    await note.save();
  }
  return { id: String(note._id), isRead: true };
}

/** Mark the whole inbox read. */
export async function markAllRead(userId: string) {
  const res = await Notification.updateMany(
    { recipient: userId, isRead: false },
    {
      isRead: true,
      readAt: new Date(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  );
  return { updated: res.modifiedCount };
}
