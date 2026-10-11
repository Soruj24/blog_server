import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const slugField = (max: number) =>
  z.string().trim().toLowerCase().min(1).max(max).regex(/^[a-z0-9-]+$/, "Invalid slug");
const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Color must be hex like #0f172a")
  .nullable()
  .optional();

/** POST /categories — admin. Slug auto-generated from name when omitted. */
export const createCategorySchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(60),
      slug: slugField(80).optional(),
      description: z.string().trim().max(300).default(""),
      color: hexColor,
      icon: z.string().trim().max(12).default(""),
      seoTitle: z.string().trim().max(70).default(""),
      seoDescription: z.string().trim().max(160).default(""),
      order: z.number().int().min(0).max(1000).default(0),
      isActive: z.boolean().default(true),
    })
    .strict(),
});

/** PATCH /categories/:id — admin. Slugs are stable: renaming never
 *  rewrites the slug unless an explicit slug is provided. */
export const updateCategorySchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(2).max(60).optional(),
      slug: slugField(80).optional(),
      description: z.string().trim().max(300).optional(),
      color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Color must be hex like #0f172a").nullable().optional(),
      icon: z.string().trim().max(12).optional(),
      seoTitle: z.string().trim().max(70).optional(),
      seoDescription: z.string().trim().max(160).optional(),
      order: z.number().int().min(0).max(1000).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: "Provide at least one field" }),
});

/** DELETE /categories/:id — admin. Blocked while posts reference the
 *  category unless ?reassignTo=<otherId> moves them explicitly. */
export const deleteCategorySchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({ reassignTo: objectId.optional() }),
});

/** POST /tags — admin. */
export const createTagSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(40),
      slug: slugField(60).optional(),
      description: z.string().trim().max(200).default(""),
    })
    .strict(),
});

/** PATCH /tags/:id — admin. Same slug-stability rule as categories. */
export const updateTagSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      name: z.string().trim().min(2).max(40).optional(),
      slug: slugField(60).optional(),
      description: z.string().trim().max(200).optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: "Provide at least one field" }),
});

/** DELETE /tags/:id — admin. Blocked while posts carry the tag unless
 *  ?detach=true explicitly strips it from every post. */
export const deleteTagSchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({ detach: z.enum(["true", "false"]).default("false") }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>["body"];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>["body"];
export type CreateTagInput = z.infer<typeof createTagSchema>["body"];
export type UpdateTagInput = z.infer<typeof updateTagSchema>["body"];
