import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * PostView = View/Analytics raw event.
 *
 * Scale design (this is the highest-write collection):
 * - `viewerHash` = HMAC(IP + User-Agent + day-salt), NEVER raw IP (privacy).
 * - Unique {post, viewerHash, day} dedupes refresh spam at the DB layer;
 *   duplicate hits fail the unique index instead of inflating counts.
 * - `post.views` counter is incremented only on successful insert.
 * - TTL (90 days) bounds raw-event growth; long-term trends come from a
 *   nightly aggregation job (Phase 6) into per-day rollups.
 * - `day` is a "YYYY-MM-DD" string so grouping needs no date operators.
 */
const postViewSchema = new Schema(
  {
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    viewerHash: { type: String, required: true, maxlength: 128 },
    day: {
      type: String,
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, "day must be YYYY-MM-DD"],
    },
    referrer: { type: String, default: null, trim: true, maxlength: 1024 },
    country: { type: String, default: null, trim: true, maxlength: 2 },
    viewedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

postViewSchema.index({ post: 1, viewerHash: 1, day: 1 }, { unique: true });
postViewSchema.index({ post: 1, day: 1 });
postViewSchema.index({ day: 1, viewerHash: 1 });
postViewSchema.index({ viewedAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export type PostViewDoc = InferSchemaType<typeof postViewSchema>;
export const PostView = models["PostView"] ?? model("PostView", postViewSchema);
