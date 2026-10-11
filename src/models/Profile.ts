import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Profile = public author page (1-to-1 with User).
 * Split from User so profile edits never touch auth credentials and the
 * public page can be cached aggressively by username.
 *
 * Counters (followerCount/followingCount/postCount) are the ONE deliberate
 * denormalization: updated transactionally in Follow/Post services, read
 * on every profile render — far cheaper than countDocuments per view.
 */
const profileSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
      match: [/^[a-z0-9_]+$/, "Username may only contain a-z, 0-9 and _"],
    },
    displayName: { type: String, required: true, trim: true, maxlength: 80 },
    // Professional headline shown on the author page + directory
    // (e.g. "ML Engineer & AI Writer"). Free text, never verified.
    title: { type: String, default: "", trim: true, maxlength: 80 },
    // Writing specialties shown as chips (e.g. ["LLMs", "MLOps"]).
    expertise: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 10 && v.every((s) => s.length <= 40),
        message: "At most 10 areas of expertise, 40 chars each",
      },
    },
    bio: { type: String, default: "", trim: true, maxlength: 500 },
    // CDN URL for fast reads; the upload itself is tracked in Media.
    avatarUrl: { type: String, default: null, maxlength: 1024 },
    coverUrl: { type: String, default: null, maxlength: 1024 },
    website: { type: String, default: null, trim: true, maxlength: 254 },
    twitter: { type: String, default: null, trim: true, maxlength: 80 },
    github: { type: String, default: null, trim: true, maxlength: 80 },
    linkedin: { type: String, default: null, trim: true, maxlength: 120 },
    location: { type: String, default: null, trim: true, maxlength: 120 },
    followerCount: { type: Number, default: 0, min: 0 },
    followingCount: { type: Number, default: 0, min: 0 },
    postCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

profileSchema.index({ followerCount: -1 });

export type ProfileDoc = InferSchemaType<typeof profileSchema>;
export const Profile = models["Profile"] ?? model("Profile", profileSchema);
