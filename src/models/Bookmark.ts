import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Bookmark = save-for-later (posts only — comments are not bookmarkable).
 * `folder` gives free grouping ("Reading list", "Research") without a
 * separate Folder collection until usage justifies one.
 */
const bookmarkSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    post: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    folder: { type: String, default: "Reading list", trim: true, maxlength: 50 },
  },
  { timestamps: true },
);

bookmarkSchema.index({ user: 1, post: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, createdAt: -1 });
bookmarkSchema.index({ post: 1 });

export type BookmarkDoc = InferSchemaType<typeof bookmarkSchema>;
export const Bookmark = models["Bookmark"] ?? model("Bookmark", bookmarkSchema);
