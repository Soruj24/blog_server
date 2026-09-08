import { z } from "zod";
import { POST_STATUSES } from "../models/Post.js";
import { COMMENT_STATUSES } from "../models/Comment.js";
import { MEDIA_USAGES } from "../models/Media.js";
import { SUBSCRIBER_STATUSES } from "../models/NewsletterSubscriber.js";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const ids = z.array(objectId).min(1).max(100);
const pageQuery = (maxLimit: number) =>
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(20),
  });

/** GET /admin/posts */
export const adminPostsSchema = z.object({
  query: pageQuery(50).extend({
    status: z.enum(POST_STATUSES).optional(),
    search: z.string().trim().max(100).optional(),
  }),
});

/** PATCH /admin/posts/bulk */
export const bulkPostsSchema = z.object({
  body: z
    .object({
      ids,
      action: z.enum(["publish", "draft", "archive", "delete"]),
    })
    .strict(),
});

/** GET /admin/comments */
export const adminCommentsSchema = z.object({
  query: pageQuery(50).extend({
    status: z.enum(COMMENT_STATUSES).optional(),
    search: z.string().trim().max(100).optional(),
  }),
});

/** PATCH /admin/comments/bulk */
export const bulkCommentsSchema = z.object({
  body: z
    .object({
      ids,
      action: z.enum(["approve", "reject", "spam", "delete"]),
    })
    .strict(),
});

/** GET /admin/media */
export const adminMediaSchema = z.object({
  query: pageQuery(50).extend({
    usage: z.enum(MEDIA_USAGES).optional(),
    search: z.string().trim().max(100).optional(),
    format: z.string().trim().max(20).optional(),
  }),
});

/** GET /admin/newsletter */
export const adminNewsletterSchema = z.object({
  query: pageQuery(50).extend({
    status: z.enum(SUBSCRIBER_STATUSES).optional(),
    search: z.string().trim().max(100).optional(),
  }),
});

/** PATCH /admin/users/bulk */
export const bulkUsersSchema = z.object({
  body: z
    .object({
      ids,
      status: z.enum(["active", "suspended"]),
    })
    .strict(),
});

/** PATCH /admin/settings */
export const updateSettingsSchema = z.object({
  body: z
    .object({
      siteName: z.string().trim().min(1).max(80).optional(),
      tagline: z.string().trim().max(200).optional(),
      logoUrl: z.string().trim().max(1024).nullable().optional(),
      faviconUrl: z.string().trim().max(1024).nullable().optional(),
      postsPerPage: z.number().int().min(5).max(50).optional(),
      featuredLimit: z.number().int().min(1).max(20).optional(),
      registrationEnabled: z.boolean().optional(),
      commentsEnabled: z.boolean().optional(),
      newsletterEnabled: z.boolean().optional(),
      maintenanceMode: z.boolean().optional(),
      twitterUrl: z.string().trim().max(254).nullable().optional(),
      githubUrl: z.string().trim().max(254).nullable().optional(),
      linkedinUrl: z.string().trim().max(254).nullable().optional(),
      defaultSeoTitle: z.string().trim().max(70).nullable().optional(),
      defaultSeoDescription: z.string().trim().max(160).nullable().optional(),
    })
    .strict()
    .refine((b) => Object.keys(b).length > 0, { message: "Provide at least one field" }),
});

/** GET /admin/analytics */
export const analyticsSchema = z.object({
  query: z
    .object({
      days: z.coerce.number().int().optional(),
      start: z.string().trim().optional(),
      end: z.string().trim().optional(),
    })
    .superRefine((q, ctx) => {
      const hasCustom = !!(q.start || q.end);
      if (hasCustom) {
        if (!q.start || !q.end) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Both start and end required for custom range", path: ["start"] });
          return;
        }
        const s = new Date(q.start);
        const e = new Date(q.end);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid date format (use YYYY-MM-DD)", path: ["start"] });
          return;
        }
        if (s > e) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "start must be before end", path: ["start"] });
          return;
        }
        const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (diff > 90) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Custom range max 90 days", path: ["end"] });
        }
      } else {
        const d = q.days ?? 30;
        if (![1, 7, 30, 90].includes(d)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "days must be 1, 7, 30, or 90", path: ["days"] });
        }
      }
    }),
});

export type BulkPostsInput = z.infer<typeof bulkPostsSchema>["body"];
export type BulkCommentsInput = z.infer<typeof bulkCommentsSchema>["body"];
export type BulkUsersInput = z.infer<typeof bulkUsersSchema>["body"];
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>["body"];
