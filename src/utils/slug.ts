/**
 * Clean SEO-friendly slugs: lowercase, ASCII, hyphen-separated.
 * "Next.js & React!" → "next-js-react". Diacritics are folded (é → e).
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Unique slug with numeric suffix ("react", "react-2", ...).
 * `excludeId` lets updates keep their own slug without false collision.
 * Typed structurally so any Mongoose model fits without casts.
 */
export async function uniqueSlug(
  model: { exists(filter: unknown): Promise<unknown> },
  base: string,
  excludeId?: unknown,
): Promise<string> {
  const stem = slugify(base) || "item";
  let candidate = stem;
  let n = 2;
  for (;;) {
    const clash = await model.exists({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    });
    if (!clash) return candidate;
    candidate = `${stem}-${n}`;
    n += 1;
  }
}
