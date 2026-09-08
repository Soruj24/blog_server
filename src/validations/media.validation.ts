import { z } from "zod";
import { MEDIA_USAGES } from "../models/Media.js";

export const listMediaSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    search: z.string().trim().max(100).optional(),
    usage: z.enum(MEDIA_USAGES).optional(),
    format: z.string().trim().max(20).optional(),
  }),
});

export const updateMediaSchema = z.object({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") }),
  body: z
    .object({
      alt: z.string().trim().max(200).optional(),
      usage: z.enum(MEDIA_USAGES).optional(),
      folder: z.string().trim().max(120).optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: "Provide at least one field" }),
});

export const mediaIdSchema = z.object({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") }),
});
