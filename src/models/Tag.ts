import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Tag = folksonomy (author-created, higher cardinality than Category).
 * Same counter pattern as Category. Unique on both name and slug so
 * renames can't create near-duplicate tags.
 */
const tagSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 60,
      match: [/^[a-z0-9-]+$/, "Invalid slug"],
    },
    description: { type: String, default: "", trim: true, maxlength: 200 },
    postCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

tagSchema.index({ postCount: -1 });

export type TagDoc = InferSchemaType<typeof tagSchema>;
export const Tag = models["Tag"] ?? model("Tag", tagSchema);
