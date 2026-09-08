import { z } from "zod";

const email = z.string().trim().toLowerCase().max(254).pipe(z.email("Invalid email address"));
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password too long");

/** POST /auth/register — creates User + Profile, returns user + token. */
export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email,
    password,
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3)
      .max(30)
      .regex(/^[a-z0-9_]+$/, "Username may only contain a-z, 0-9 and _")
      .optional(),
  }),
});

/** POST /auth/login — verifies credentials, returns user + token. */
export const loginSchema = z.object({
  body: z.object({
    email,
    password: z.string().min(1, "Password is required").max(128),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>["body"];
export type LoginInput = z.infer<typeof loginSchema>["body"];
