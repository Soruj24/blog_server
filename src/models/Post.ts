import { Schema, model, models, type InferSchemaType } from "mongoose";

export const POST_STATUSES = ["draft", "scheduled", "published", "archived"] as const;
export const POST_VISIBILITY = ["public", "unlisted", "private"] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function estimateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Post = the core document. Everything else (comments, likes, views)
 * references it; counters on it are maintained transactionally so feed
 * queries never need $lookup or countDocuments.
 *
 * Data rules:
 * - Only {_id, slug} identify a post publicly; slug is immutable after
 *   first publish (changing it breaks canonical URLs + SEO).
 * - `content` stores Markdown; rendering to HTML happens client-side.
 * - `trending`/`featured` are flags maintained by jobs/editors, indexed
 *   for feed sorting — never computed per request.
 * - `scheduledAt` is required iff status === "scheduled" (validated below).
 *
 * Efficient patterns: feed = {status, visibility, publishedAt} prefix;
 * author dashboard = {author, status} prefix; cursor pagination on
 * {publishedAt, _id} — never skip() deep pages.
 */
const postSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 8, maxlength: 150 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 180,
      match: [/^[a-z0-9-]+$/, "Invalid slug"],
    },
    excerpt: { type: String, required: true, trim: true, minlength: 1, maxlength: 300 },
    content: { type: String, required: true, minlength: 1, maxlength: 100000 },
    // Fast CDN URL for feeds/SEO; the managed upload lives in Media.
    coverImage: { type: String, default: null, maxlength: 1024 },
    coverMedia: { type: Schema.Types.ObjectId, ref: "Media", default: null },

    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],

    status: { type: String, enum: POST_STATUSES, default: "draft", index: true },
    visibility: { type: String, enum: POST_VISIBILITY, default: "public", index: true },
    featured: { type: Boolean, default: false, index: true },
    trending: { type: Boolean, default: false, index: true },

    readingTime: { type: Number, default: 1, min: 1, max: 120 },
    views: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },
    bookmarkCount: { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },

    publishedAt: { type: Date, default: null, index: true },
    scheduledAt: {
      type: Date,
      default: null,
      validate: {
        validator(this: { status?: string }, v: Date | null) {
          if (this.status === "scheduled") return v instanceof Date;
          return true;
        },
        message: "scheduledAt is required when status is 'scheduled'",
      },
    },

    // SEO — falls back to title/excerpt/coverImage when absent.
    seoTitle: { type: String, default: null, trim: true, maxlength: 70 },
    seoDescription: { type: String, default: null, trim: true, maxlength: 160 },
    canonicalUrl: { type: String, default: null, trim: true, maxlength: 1024 },
    ogImage: { type: String, default: null, maxlength: 1024 },
    noIndex: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Auto-slug + reading time so writers can omit them; runs before validation.
postSchema.pre("validate", function () {
  const doc = this as unknown as {
    slug?: string;
    title?: string;
    content?: string;
    readingTime?: number;
    status?: string;
    publishedAt?: Date | null;
  };
  if (!doc.slug && doc.title) doc.slug = slugify(doc.title);
  else if (doc.slug) doc.slug = slugify(doc.slug);
  if (doc.content) doc.readingTime = estimateReadingTime(doc.content);
  if (doc.status === "published" && !doc.publishedAt) {
    doc.publishedAt = new Date();
  }
});

// Feed / discovery
postSchema.index({ status: 1, visibility: 1, publishedAt: -1 });
postSchema.index({ category: 1, status: 1, publishedAt: -1 });
postSchema.index({ author: 1, status: 1, publishedAt: -1 });
// Scheduler job: due posts, smallest scan possible
postSchema.index({ status: 1, scheduledAt: 1 });
// Ranked feeds (counters are maintained, so sorts are index-friendly)
postSchema.index({ status: 1, views: -1 });
postSchema.index({ status: 1, likeCount: -1 });
postSchema.index({ featured: 1, status: 1, publishedAt: -1 });
// Full-text search with relevance weights: title > excerpt > body.
// NOTE: changing this definition does NOT alter the existing DB index —
// run `npm run db:sync` once after editing (Mongoose won't rebuild it).
postSchema.index(
  { title: "text", excerpt: "text", content: "text" },
  { weights: { title: 10, excerpt: 5, content: 2 }, name: "post_text_search" },
);
// Prefix lookups for typeahead suggestions (anchored regex uses this).
postSchema.index({ title: 1 });

export type PostDoc = InferSchemaType<typeof postSchema>;
export const Post = models["Post"] ?? model("Post", postSchema);
