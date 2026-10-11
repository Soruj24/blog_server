/**
 * Categories + tags. Idempotent:
 * - New slug/name → insert.
 * - Existing name with a different slug → admin's category wins, skip.
 * - Existing slug → never rename/re-describe; only backfill EMPTY
 *   presentational/SEO fields (icon, seoTitle, seoDescription).
 */
import { Category } from "../models/Category.js";
import { Tag } from "../models/Tag.js";
import { CATEGORIES, TAGS } from "./data.js";

export async function seedTaxonomy(fresh: boolean): Promise<void> {
  if (fresh) {
    await Category.deleteMany({});
    await Tag.deleteMany({});
    console.log("[seed] cleared categories + tags");
  }
  let created = 0;
  let skipped = 0;
  for (const c of CATEGORIES) {
    const doc = await Category.findOne({ $or: [{ slug: c.slug }, { name: c.name }] }).select(
      "slug name description icon seoTitle seoDescription",
    );
    if (!doc) {
      await Category.create({
        ...c,
        seoTitle: `${c.name} — Stories & Insights | Inkwell`.slice(0, 70),
        seoDescription: `${c.description} Browse ${c.name} stories, guides, and essays on Inkwell.`.slice(0, 160),
      });
      created += 1;
      continue;
    }
    if (doc.slug !== c.slug) {
      // Same name, different slug — an admin's category wins; never touch it.
      console.log(`[seed] category name taken with another slug, skipping: ${c.name}`);
      skipped += 1;
      continue;
    }
    // Existing (possibly production-edited) categories are never renamed
    // or re-described — only empty presentational/SEO fields are backfilled.
    const backfill: Record<string, string> = {};
    if (!doc.icon) backfill["icon"] = c.icon;
    if (!doc.seoTitle) backfill["seoTitle"] = `${c.name} — Stories & Insights | Inkwell`.slice(0, 70);
    if (!doc.seoDescription) backfill["seoDescription"] = `${doc.description || c.description} Browse ${c.name} stories on Inkwell.`.slice(0, 160);
    if (Object.keys(backfill).length > 0) {
      await Category.updateOne({ slug: c.slug }, { $set: backfill });
    }
  }
  for (const slug of TAGS) {
    const name = slug.replace(/-/g, " ");
    await Tag.updateOne({ slug }, { $setOnInsert: { name, slug } }, { upsert: true });
  }
  console.log(`[seed] categories + tags ready (${created} inserted, ${skipped} skipped, ${CATEGORIES.length} managed)`);
}
