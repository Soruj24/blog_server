import { Post } from "../models/Post.js";
import { Tag } from "../models/Tag.js";
import { ApiError } from "../utils/ApiError.js";
import { stripHtml } from "../utils/sanitize.js";
import { slugify, uniqueSlug } from "../utils/slug.js";
import type {
  CreateTagInput,
  UpdateTagInput,
} from "../validations/taxonomy.validation.js";

/**
 * Public tag directory — most-used first, capped for filter dropdowns.
 * Counts ride along (maintained postCount), so no aggregation needed.
 */
export async function listTags(limit: number) {
  return Tag.find({ postCount: { $gt: 0 } })
    .select("name slug postCount")
    .sort({ postCount: -1, name: 1 })
    .limit(limit)
    .lean();
}

/** Full tag directory for admin + tag index pages (includes unused tags). */
export async function listAllTags(limit: number) {
  return Tag.find({})
    .select("name slug description postCount createdAt")
    .sort({ postCount: -1, name: 1 })
    .limit(limit)
    .lean();
}

export async function recomputeTagCount(id: unknown) {
  const count = await Post.countDocuments({ tags: id, status: "published" });
  await Tag.updateOne({ _id: id }, { postCount: count });
  return count;
}

/** Admin create — slug generated from name when omitted, always unique. */
export async function createTag(input: CreateTagInput) {
  input.name = stripHtml(input.name).trim();
  if (input.description) input.description = stripHtml(input.description).trim();
  const nameClash = await Tag.exists({ name: input.name });
  if (nameClash) throw new ApiError(409, "Tag name already exists");
  const slug = await uniqueSlug(Tag, input.slug ? slugify(input.slug) : input.name);
  return Tag.create({ ...input, slug });
}

/** Admin update — same slug-stability rule as categories. */
export async function updateTag(id: string, input: UpdateTagInput) {
  if (input.name) {
    input.name = stripHtml(input.name).trim();
    const clash = await Tag.exists({ name: input.name, _id: { $ne: id } });
    if (clash) throw new ApiError(409, "Tag name already exists");
  }
  if (input.description !== undefined && input.description !== null) {
    input.description = stripHtml(input.description).trim();
  }
  const patch: Record<string, unknown> = { ...input };
  if (input.slug) patch["slug"] = await uniqueSlug(Tag, input.slug, id);
  const tag = await Tag.findByIdAndUpdate(id, patch, { new: true, runValidators: true });
  if (!tag) throw new ApiError(404, "Tag not found");
  return tag;
}

/** Admin delete — refused while ANY post carries the tag, unless
 *  ?detach=true explicitly strips it from every post first. Unlike
 *  categories there is no reassignment: a removed tag simply unlabels. */
export async function removeTag(id: string, detach: boolean) {
  const tag = await Tag.findById(id).select("_id");
  if (!tag) throw new ApiError(404, "Tag not found");
  const usage = await Post.countDocuments({ tags: id });
  if (usage > 0 && !detach) {
    throw new ApiError(
      409,
      `${usage} ${usage === 1 ? "post carries" : "posts carry"} this tag — pass ?detach=true to strip it first`,
      { usage },
    );
  }
  if (detach) {
    await Post.updateMany({ tags: id }, { $pull: { tags: id } });
  }
  await Tag.deleteOne({ _id: id });
  return { deleted: true, detachedFrom: detach ? usage : 0 };
}
