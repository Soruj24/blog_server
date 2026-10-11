import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * Category = curated taxonomy (admin-managed, low cardinality).
 * postCount maintained by Post service — avoids countDocuments on every
 * category page. `order` drives nav sorting, `isActive` soft-hides.
 */
const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 80,
      match: [/^[a-z0-9-]+$/, "Invalid slug"],
    },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    color: {
      type: String,
      default: null,
      match: [/^#[0-9a-fA-F]{6}$/, "Color must be hex like #0f172a"],
    },
    // Emoji/short glyph shown on directory tiles (e.g. "🤖"). Purely
    // presentational; feeds and slugs never depend on it.
    icon: { type: String, default: "", trim: true, maxlength: 12 },
    // Optional per-category SEO overrides. Hub pages fall back to
    // generated titles/descriptions when these are empty.
    seoTitle: { type: String, default: "", trim: true, maxlength: 70 },
    seoDescription: { type: String, default: "", trim: true, maxlength: 160 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    postCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

categorySchema.index({ isActive: 1, order: 1 });

export type CategoryDoc = InferSchemaType<typeof categorySchema>;
export const Category = models["Category"] ?? model("Category", categorySchema);
