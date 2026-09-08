import { Schema, model, models, type InferSchemaType } from "mongoose";

export const NOTIFICATION_TYPES = [
  "follow",
  "like",
  "comment",
  "reply",
  "mention",
  "publish",
  "bookmark",
  "approved",
  "system",
] as const;

/**
 * Notification = inbox item for one recipient.
 * `actor` is null for system messages. post/comment refs allow
 * deep-linking ("X replied to your comment"). `expiresAt` + TTL keeps
 * the collection bounded: read items age out automatically.
 */
const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    body: { type: String, default: "", trim: true, maxlength: 300 },
    post: { type: Schema.Types.ObjectId, ref: "Post", default: null },
    comment: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    // Set on read (e.g. now + 90d) so TTL can reclaim space.
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Inbox view: unread first, newest first
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
// TTL — MongoDB deletes docs once expiresAt passes
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;
export const Notification =
  models["Notification"] ?? model("Notification", notificationSchema);
