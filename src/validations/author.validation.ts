import { z } from "zod";

export const usernameParams = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, "Invalid username"),
});

/** GET /authors/:username — public profile. */
export const authorUsernameSchema = z.object({ params: usernameParams });

/** GET /authors — public directory. Paginated, generous cap for hubs. */
export const listAuthorsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(24),
  }),
});
