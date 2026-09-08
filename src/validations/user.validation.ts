import { z } from "zod";
import { USER_ROLES, USER_STATUSES } from "../models/User.js";

const usernameParam = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/);

/** PATCH /users/me — own identity fields only (never role/status). */
export const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      image: z.string().trim().max(1024).optional(),
    })
    .strict(),
});

/** PATCH /users/me/profile — public author page fields. */
export const updateProfileSchema = z.object({
  body: z
    .object({
      displayName: z.string().trim().min(2).max(80).optional(),
      bio: z.string().trim().max(500).optional(),
      avatarUrl: z.string().trim().max(1024).nullable().optional(),
      coverUrl: z.string().trim().max(1024).nullable().optional(),
      website: z.string().trim().max(254).nullable().optional(),
      twitter: z.string().trim().max(80).nullable().optional(),
      github: z.string().trim().max(80).nullable().optional(),
      linkedin: z.string().trim().max(120).nullable().optional(),
      location: z.string().trim().max(120).nullable().optional(),
    })
    .strict(),
});

/** GET /users/by-username/:username — public profile lookup. */
export const userByUsernameSchema = z.object({
  params: z.object({ username: usernameParam }),
});

/** GET /users/:id — admin or self lookup by id. */
export const userByIdSchema = z.object({
  params: z.object({ id: z.string().length(24, "Invalid user id") }),
});

/** GET /users — admin listing with cursor-free page pagination + filters. */
export const listUsersSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
    search: z.string().trim().max(80).optional(),
  }),
});

/** GET /users/authors/popular — public author leaderboard. */
export const popularAuthorsSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(12).default(6),
  }),
});

/** GET /users/me/bookmarks — own reading list. */
export const myBookmarksSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(30).default(12),
  }),
});

/** PATCH /users/:id — admin only: role + status transitions. */
export const adminUpdateUserSchema = z.object({
  params: z.object({ id: z.string().length(24, "Invalid user id") }),
  body: z
    .object({
      role: z.enum(USER_ROLES).optional(),
      status: z.enum(USER_STATUSES).optional(),
    })
    .strict()
    .refine((b) => b.role !== undefined || b.status !== undefined, {
      message: "Provide role and/or status",
    }),
});

export type UpdateMeInput = z.infer<typeof updateMeSchema>["body"];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];
