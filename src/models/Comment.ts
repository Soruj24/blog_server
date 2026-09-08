import { Schema, model, models, type InferSchemaType } from "mongoose";

export const COMMENT_STATUSES = ["pending", "approved", "rejected", "spam"] as const;
export const REPORT_REASONS = [
  "spam",
  "harassment",
  "hate-speech",
  "misinformation",
  "other",
] as const;
/** Reports auto-escalate a comment into the review queue at this count. */
export const REPORT_THRESHOLD = 3;

const reportSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

/**
 * Comment with ONE level of threading (parent → top-level comment).
 * Single-level keeps tree queries to 2 indexed lookups (thread + replies)
 * instead of recursive graph traversals.
 *
 * Lifecycle: approved (default, public) → rejected/spam (hidden) via
 * moderation; pending = awaiting review (auto-set at REPORT_THRESHOLD,
 * visible to its author only). Deletion is a tombstone when replies
 * exist (isDeleted), hard delete otherwise — threads never dangle.
 *
 * post.commentCount / parent replyCount are maintained by the service;
 * likeCount mirrors Like docs for Comment targets.
 */
const commentSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    parent: { type: Schema.Types.ObjectId, ref: "Comment", default: null, index: true },
    content: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
    status: { type: String, enum: COMMENT_STATUSES, default: "approved", index: true },
    likeCount: { type: Number, default: 0, min: 0 },
    replyCount: { type: Number, default: 0, min: 0 },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    flagCount: { type: Number, default: 0, min: 0 },
    reports: { type: [reportSchema], default: [] },
  },
  { timestamps: true },
);

// Thread view: approved comments on a post, oldest first
commentSchema.index({ post: 1, status: 1, createdAt: 1 });
// Replies to one comment
commentSchema.index({ parent: 1, status: 1, createdAt: 1 });
// Moderation queue: pending first, oldest first
commentSchema.index({ status: 1, createdAt: 1 });
// Moderation / user history
commentSchema.index({ author: 1, createdAt: -1 });

export type CommentDoc = InferSchemaType<typeof commentSchema>;
export const Comment = models["Comment"] ?? model("Comment", commentSchema);
