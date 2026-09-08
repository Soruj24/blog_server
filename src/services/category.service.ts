import { Category } from "../models/Category.js";
import { Post } from "../models/Post.js";
import { ApiError } from "../utils/ApiError.js";
import { stripHtml } from "../utils/sanitize.js";
import { slugify, uniqueSlug } from "../utils/slug.js";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../validations/taxonomy.validation.js";

/** Public category directory — active only, nav order. Counts ride along. */
export async function listCategories() {
  return Category.find({ isActive: true })
    .select("name slug description color postCount")
    .sort({ order: 1, name: 1 })
    .lean();
}

/** Admin directory — includes hidden categories and management fields. */
export async function listAllCategories() {
  return Category.find({})
    .select("name slug description color order isActive postCount createdAt")
    .sort({ order: 1, name: 1 })
    .lean();
}

/** Counts mirror published posts (matches seed + feed semantics). */
export async function recomputeCategoryCount(id: unknown) {
  const count = await Post.countDocuments({ category: id, status: "published" });
  await Category.updateOne({ _id: id }, { postCount: count });
  return count;
}

/** Admin create — slug generated from name when omitted, always unique. */
export async function createCategory(input: CreateCategoryInput) {
  input.name = stripHtml(input.name).trim();
  if (input.description) input.description = stripHtml(input.description).trim();
  const nameClash = await Category.exists({ name: input.name });
  if (nameClash) throw new ApiError(409, "Category name already exists");
  const slug = await uniqueSlug(
    Category,
    input.slug ? slugify(input.slug) : input.name,
  );
  return Category.create({ ...input, slug });
}

/** Admin update — renames never rewrite the slug unless one is explicit
 *  (stable URLs are an SEO promise). */
export async function updateCategory(id: string, input: UpdateCategoryInput) {
  if (input.name) {
    input.name = stripHtml(input.name).trim();
    const clash = await Category.exists({ name: input.name, _id: { $ne: id } });
    if (clash) throw new ApiError(409, "Category name already exists");
  }
  if (input.description !== undefined && input.description !== null) {
    input.description = stripHtml(input.description).trim();
  }
  const patch: Record<string, unknown> = { ...input };
  if (input.slug) patch["slug"] = await uniqueSlug(Category, input.slug, id);
  const category = await Category.findByIdAndUpdate(id, patch, {
    new: true,
    runValidators: true,
  });
  if (!category) throw new ApiError(404, "Category not found");
  return category;
}

/** Admin delete — refused while ANY post (draft included) references the
 *  category, unless ?reassignTo moves them to a surviving category first. */
export async function removeCategory(id: string, reassignTo?: string) {
  const category = await Category.findById(id).select("_id");
  if (!category) throw new ApiError(404, "Category not found");
  const usage = await Post.countDocuments({ category: id });
  if (usage > 0 && !reassignTo) {
    throw new ApiError(
      409,
      `${usage} ${usage === 1 ? "post uses" : "posts use"} this category — pass ?reassignTo=<categoryId> to move them first`,
      { usage },
    );
  }
  if (reassignTo) {
    if (reassignTo === id) throw new ApiError(400, "Cannot reassign a category to itself");
    const target = await Category.findById(reassignTo).select("_id");
    if (!target) throw new ApiError(404, "Reassignment target not found");
    await Post.updateMany({ category: id }, { category: reassignTo });
  }
  await Category.deleteOne({ _id: id });
  if (reassignTo) await recomputeCategoryCount(reassignTo);
  return { deleted: true, movedPosts: reassignTo ? usage : 0 };
}
