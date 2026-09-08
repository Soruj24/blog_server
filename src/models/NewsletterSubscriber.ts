import { Schema, model, models, type InferSchemaType } from "mongoose";

export const SUBSCRIBER_STATUSES = ["pending", "active", "unsubscribed", "bounced"] as const;

/**
 * NewsletterSubscriber with double opt-in lifecycle:
 * pending (token sent) → active → unsubscribed|bounced.
 * Separate from User: subscribers may never register.
 * Consent is stored for GDPR: consentGiven + consentAt + consentText + ip.
 */
const newsletterSubscriberSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    name: { type: String, default: null, trim: true, maxlength: 80 },
    status: { type: String, enum: SUBSCRIBER_STATUSES, default: "pending", index: true },
    source: { type: String, default: "site", trim: true, maxlength: 60 },
    confirmToken: { type: String, default: null, select: false },
    subscribedAt: { type: Date, default: null },
    unsubscribedAt: { type: Date, default: null },
    consentGiven: { type: Boolean, default: false },
    consentAt: { type: Date, default: null },
    consentText: { type: String, default: null, maxlength: 500 },
    consentIp: { type: String, default: null, maxlength: 45 },
  },
  { timestamps: true },
);

newsletterSubscriberSchema.index({ status: 1, subscribedAt: -1 });

export type NewsletterSubscriberDoc = InferSchemaType<typeof newsletterSubscriberSchema>;
export const NewsletterSubscriber =
  models["NewsletterSubscriber"] ?? model("NewsletterSubscriber", newsletterSubscriberSchema);
