import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/** GET /notifications */
export const listNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(30).default(15),
  }),
});

/** PATCH /notifications/:id/read */
export const markReadSchema = z.object({
  params: z.object({ id: objectId }),
});

/** POST /notifications/announce — admin only */
export const announceSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(5).max(140),
      body: z.string().trim().max(300).optional(),
    })
    .strict(),
});
