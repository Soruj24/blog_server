import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Like = polymorphic (Post | Comment) via refPath.
 * One collection instead of postLikes/commentLikes: a single unique
 * constraint shape and one code path for toggle logic.
 * post.likeCount / comment.likeCount mirror these docs for fast sorts.
 */
const likeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetKind: { type: String, enum: ["Post", "Comment"], required: true },
    target: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: "targetKind",
    },
  },
  { timestamps: true },
);

// One like per user per target — the core invariant
likeSchema.index({ user: 1, targetKind: 1, target: 1 }, { unique: true });
// "Who liked this?" + counting per target
likeSchema.index({ targetKind: 1, target: 1, createdAt: -1 });

export type LikeDoc = InferSchemaType<typeof likeSchema>;
export const Like = models["Like"] ?? model("Like", likeSchema);
