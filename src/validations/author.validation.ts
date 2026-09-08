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
