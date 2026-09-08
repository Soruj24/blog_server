import { Schema, model, models, type InferSchemaType } from "mongoose";

export const MEDIA_USAGES = ["avatar", "cover", "post-body", "other"] as const;

/**
 * Media = registry of Cloudinary uploads.
 * Cloudinary is the source of truth for bytes; this collection is the
 * queryable index (owner, usage, owning post) so deletions and
 * "all images in this post" never require Cloudinary API listing calls.
 */
const mediaSchema = new Schema(
  {
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    post: { type: Schema.Types.ObjectId, ref: "Post", default: null, index: true },
    url: { type: String, required: true, maxlength: 1024 },
    publicId: { type: String, required: true, unique: true, trim: true },
    resourceType: { type: String, enum: ["image", "video", "raw"], default: "image" },
    format: { type: String, default: null, trim: true, maxlength: 20 },
    width: { type: Number, default: null, min: 0 },
    height: { type: Number, default: null, min: 0 },
    bytes: { type: Number, default: null, min: 0 },
    alt: { type: String, default: "", trim: true, maxlength: 200 },
    folder: { type: String, default: "inkwell", trim: true, maxlength: 120 },
    usage: { type: String, enum: MEDIA_USAGES, default: "other", index: true },
  },
  { timestamps: true },
);

mediaSchema.index({ owner: 1, createdAt: -1 });
mediaSchema.index({ post: 1, createdAt: 1 });

export type MediaDoc = InferSchemaType<typeof mediaSchema>;
export const Media = models["Media"] ?? model("Media", mediaSchema);
