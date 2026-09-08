import { z } from "zod";

/** POST /newsletter/subscribe — idempotent signup (reactivates unsubscribed). */
export const subscribeSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .max(254)
        .pipe(z.email("Invalid email address")),
      name: z.string().trim().min(2).max(80).optional(),
      source: z.string().trim().max(60).default("homepage"),
      consent: z.boolean().refine((v) => v === true, { message: "Consent is required" }),
      consentText: z.string().trim().max(500).optional(),
    })
    .strict(),
});

/** POST /newsletter/unsubscribe — public, idempotent */
export const unsubscribeSchema = z.object({
  body: z
    .object({
      email: z
        .string()
        .trim()
        .toLowerCase()
        .max(254)
        .pipe(z.email("Invalid email address")),
    })
    .strict(),
});

/** PATCH /admin/newsletter/:id — admin deactivate/activate */
export const updateSubscriberSchema = z.object({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") }),
  body: z
    .object({
      status: z.enum(["active", "unsubscribed", "bounced"]),
    })
    .strict(),
});

export type SubscribeInput = z.infer<typeof subscribeSchema>["body"];
export type UnsubscribeInput = z.infer<typeof unsubscribeSchema>["body"];
export type UpdateSubscriberInput = z.infer<typeof updateSubscriberSchema>["body"];
