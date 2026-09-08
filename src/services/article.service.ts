import { Category } from "../models/Category.js";
import { Post } from "../models/Post.js";
import { Profile } from "../models/Profile.js";
import { Tag } from "../models/Tag.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import type { ListArticlesQuery } from "../validations/article.validation.js";

/** Phase-1 text recall cap — see the search block in listArticles. */
const TEXT_MATCH_CAP = 500;

/** Anchors user input for $regex — never let raw text become a pattern. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface PublicAuthor {
  id: string;
  name: string;
  username: string;
  avatarUrl: string | null;
}

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string | null;
  author: PublicAuthor | null;
  category: { id: string; name: string; slug: string; color: string | null } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  readingTime: number;
  views: number;
  likeCount: number;
  commentCount: number;
  publishedAt: Date | null;
  featured: boolean;
  trending: boolean;
}

/** Only released work is ever publicly visible (drafts/scheduled stay hidden). */
export function publishedFilter() {
  return {
    status: "published",
    visibility: "public",
    publishedAt: { $lte: new Date() },
  };
}

interface PopulatedPost {
  _id: unknown;
  title: string;
  slug: string;
  excerpt: string;
  coverImage?: string | null;
  author?: { _id: unknown; name: string; image?: string | null } | null;
  category?: { _id: unknown; name: string; slug: string; color?: string | null } | null;
  tags?: Array<{ _id: unknown; name: string; slug: string }>;
  readingTime: number;
  views: number;
  likeCount: number;
  commentCount: number;
  publishedAt?: Date | null;
  featured?: boolean;
  trending?: boolean;
}

/** Batch-loads public profiles so list queries stay at 2 round-trips. */
export async function attachProfiles(posts: PopulatedPost[]): Promise<ArticleListItem[]> {
  const authorIds = [...new Set(posts.flatMap((p) => (p.author?._id ? [String(p.author._id)] : [])))];
  const profiles = authorIds.length
    ? await Profile.find({ user: { $in: authorIds } })
        .select("user username displayName avatarUrl")
        .lean()
    : [];
  const byUser = new Map(profiles.map((p) => [String(p.user), p]));

  return posts.map((p) => {
    const profile = p.author ? byUser.get(String(p.author._id)) : undefined;
    return {
      id: String(p._id),
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      coverImage: p.coverImage ?? null,
      author: p.author
        ? {
            id: String(p.author._id),
            name: profile?.displayName ?? p.author.name,
            username: profile?.username ?? "",
            avatarUrl: profile?.avatarUrl ?? p.author.image ?? null,
          }
        : null,
      category: p.category
        ? {
            id: String(p.category._id),
            name: p.category.name,
            slug: p.category.slug,
            color: p.category.color ?? null,
          }
        : null,
      tags: (p.tags ?? []).map((t) => ({
        id: String(t._id),
        name: t.name,
        slug: t.slug,
      })),
      readingTime: p.readingTime,
      views: p.views,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      publishedAt: p.publishedAt ?? null,
      featured: p.featured ?? false,
      trending: p.trending ?? false,
    };
  });
}

const LIST_PROJECTION = "-content -seoTitle -seoDescription -canonicalUrl -ogImage";

/** Public feed with filters. Unknown category/tag/author slugs → 404. */
export async function listArticles(filter: ListArticlesQuery) {
  const query: Record<string, unknown> = { ...publishedFilter() };

  if (filter.category) {
    const category = await Category.findOne({ slug: filter.category }).select("_id");
    if (!category) throw new ApiError(404, "Category not found");
    query["category"] = category._id;
  }
  if (filter.tag) {
    const tag = await Tag.findOne({ slug: filter.tag }).select("_id");
    if (!tag) throw new ApiError(404, "Tag not found");
    query["tags"] = tag._id;
  }
  if (filter.author) {
    const profile = await Profile.findOne({ username: filter.author }).select("user");
    if (!profile) throw new ApiError(404, "Author not found");
    query["author"] = profile.user;
  }
  if (filter.featured === "true") query["featured"] = true;
  if (filter.trending === "true") query["trending"] = true;

  let sort: Record<string, 1 | -1> = { publishedAt: -1 };
  if (filter.sort === "popular") sort = { views: -1 };
  if (filter.sort === "liked") sort = { likeCount: -1 };
  if (filter.search) {
    // Same match object drives find + count so `total` honors the query.
    //
    // Why two phases: mongod has no plan for $text inside $or
    // ("No query solutions"), so full-text and entity matches can't share
    // one predicate. Phase 1 uses the weighted text index for recall
    // (title/excerpt/body, stemmed, stop-words removed) and collects a
    // bounded id set; phase 2 is pure indexed id lookups — paginatable
    // with exact totals. TEXT_MATCH_CAP bounds phase-1 recall; 500 is
    // generous for blog-scale corpora and documented, not silent.
    const term = filter.search;
    const like = { $regex: escapeRegExp(term), $options: "i" };
    const [users, profiles, cats, tags, textHits] = await Promise.all([
      User.find({ name: like }).select("_id").limit(10).lean(),
      Profile.find({ $or: [{ displayName: like }, { username: like }] })
        .select("user")
        .limit(10)
        .lean(),
      Category.find({ $or: [{ name: like }, { slug: like }] })
        .select("_id")
        .limit(10)
        .lean(),
      Tag.find({ $or: [{ name: like }, { slug: like }] })
        .select("_id")
        .limit(10)
        .lean(),
      Post.find({ ...publishedFilter(), $text: { $search: term } })
        .select("_id")
        .limit(TEXT_MATCH_CAP)
        .lean(),
    ]);
    query["$or"] = [
      { _id: { $in: textHits.map((h) => h._id) } },
      { author: { $in: [...users.map((u) => u._id), ...profiles.map((p) => p.user)] } },
      { category: { $in: cats.map((c) => c._id) } },
      { tags: { $in: tags.map((t) => t._id) } },
    ];
  }

  const skip = (filter.page - 1) * filter.limit;
  const [docs, total] = await Promise.all([
    Post.find(query)
      .select(LIST_PROJECTION)
      .populate("author", "name image")
      .populate("category", "name slug color")
      .populate("tags", "name slug")
      .sort(sort)
      .skip(skip)
      .limit(filter.limit)
      .lean<PopulatedPost[]>(),
    Post.countDocuments(query),
  ]);

  return { items: await attachProfiles(docs), total, page: filter.page, limit: filter.limit };
}

/**
 * Typeahead suggestions — anchored prefix regex (index-backed via the
 * title index), tiny projection, hard caps. Never returns body text.
 */
export async function suggestArticles(term: string, limit: number) {
  const prefix = new RegExp(`^${escapeRegExp(term)}`, "i");
  const [posts, tags] = await Promise.all([
    Post.find({ ...publishedFilter(), title: prefix })
      .select("title slug")
      .sort({ publishedAt: -1 })
      .limit(limit)
      .lean(),
    Tag.find({ name: prefix })
      .select("name slug")
      .sort({ postCount: -1 })
      .limit(4)
      .lean(),
  ]);
  return {
    posts: posts.map((p) => ({ id: String(p._id), title: p.title, slug: p.slug })),
    tags: tags.map((t) => ({ id: String(t._id), name: t.name, slug: t.slug })),
  };
}

/** Public detail — includes content. Read-path never mutates (no view bump). */
export async function getArticleBySlug(slug: string) {
  const doc = await Post.findOne({ ...publishedFilter(), slug })
    .populate("author", "name image")
    .populate("category", "name slug color")
    .populate("tags", "name slug")
    .lean<PopulatedPost & { content: string }>();
  if (!doc) throw new ApiError(404, "Article not found");
  const [item] = await attachProfiles([doc]);

  // Chronological neighbors (prev = older, next = newer), _id tiebreak.
  const base = { ...publishedFilter(), slug: { $ne: slug } };
  const neighbor = (dir: 1 | -1) =>
    Post.findOne({
      ...base,
      $or: [
        { publishedAt: dir === 1 ? { $gt: doc.publishedAt } : { $lt: doc.publishedAt } },
        { publishedAt: doc.publishedAt, _id: dir === 1 ? { $gt: doc._id } : { $lt: doc._id } },
      ],
    })
      .select("slug title")
      .sort({ publishedAt: dir, _id: dir })
      .lean<{ slug: string; title: string } | null>();
  const [prev, next] = await Promise.all([neighbor(-1), neighbor(1)]);

  return { ...item, content: doc.content, prev, next };
}
