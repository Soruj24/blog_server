import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Follow = directed edge follower → following (both Users).
 * Self-follow rejected at the schema layer. Profile follower/following
 * counters mirror these edges transactionally.
 */
const followSchema = new Schema(
  {
    follower: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    following: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true },
);

followSchema.pre("validate", function () {
  const doc = this as unknown as { follower?: unknown; following?: unknown };
  if (doc.follower && doc.following && String(doc.follower) === String(doc.following)) {
    throw new Error("Cannot follow yourself");
  }
});

followSchema.index({ follower: 1, following: 1 }, { unique: true });
followSchema.index({ following: 1, createdAt: -1 });
followSchema.index({ follower: 1, createdAt: -1 });

export type FollowDoc = InferSchemaType<typeof followSchema>;
export const Follow = models["Follow"] ?? model("Follow", followSchema);
