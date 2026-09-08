import { NewsletterSubscriber } from "../models/NewsletterSubscriber.js";
import { ApiError } from "../utils/ApiError.js";
import type { SubscribeInput, UnsubscribeInput } from "../validations/newsletter.validation.js";

/**
 * Idempotent subscribe. Reactivates unsubscribed/bounced, leaves active untouched.
 * Duplicate prevention via unique email index + duplicate-key handling.
 * Consent is required and stored for GDPR.
 */
export async function subscribe(
  input: SubscribeInput & { ip?: string | null },
) {
  if (!input.consent) throw new ApiError(400, "Consent is required");

  const consentAt = new Date();
  const consentText = input.consentText || "I agree to receive newsletters and updates";

  const existing = await NewsletterSubscriber.findOne({ email: input.email });
  if (existing) {
    if (existing.status === "active") return { subscribed: true, reactivated: false };
    existing.status = "active";
    existing.unsubscribedAt = null;
    existing.subscribedAt = new Date();
    existing.consentGiven = true;
    existing.consentAt = consentAt;
    existing.consentText = consentText;
    if (input.ip) existing.consentIp = input.ip;
    if (input.name) existing.name = input.name;
    existing.source = input.source;
    await existing.save();
    return { subscribed: true, reactivated: true };
  }

  try {
    await NewsletterSubscriber.create({
      email: input.email,
      name: input.name ?? null,
      status: "active",
      source: input.source,
      subscribedAt: consentAt,
      consentGiven: true,
      consentAt,
      consentText,
      consentIp: input.ip ?? null,
    });
  } catch (e) {
    const err = e as { code?: number };
    if (err.code === 11000) {
      // Race: another request created same email
      return { subscribed: true, reactivated: false };
    }
    throw e;
  }
  return { subscribed: true, reactivated: false };
}

export async function unsubscribe(input: UnsubscribeInput) {
  const doc = await NewsletterSubscriber.findOne({ email: input.email });
  if (!doc) throw new ApiError(404, "Email not found");
  if (doc.status === "unsubscribed") return { unsubscribed: true, already: true };
  doc.status = "unsubscribed";
  doc.unsubscribedAt = new Date();
  await doc.save();
  return { unsubscribed: true, already: false };
}

export async function updateSubscriberStatus(
  id: string,
  status: "active" | "unsubscribed" | "bounced",
) {
  const doc = await NewsletterSubscriber.findById(id);
  if (!doc) throw new ApiError(404, "Subscriber not found");
  doc.status = status;
  if (status === "unsubscribed" || status === "bounced") {
    doc.unsubscribedAt = new Date();
  } else {
    doc.unsubscribedAt = null;
    doc.subscribedAt = doc.subscribedAt || new Date();
  }
  await doc.save();
  return doc.toObject();
}
