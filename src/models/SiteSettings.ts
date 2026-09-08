import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * SiteSettings = singleton (exactly one document, key = "site").
 * Services use getSiteSettings() which upserts with defaults — callers
 * never handle "missing settings". Cached in memory by the service layer
 * (short TTL) since it is read on nearly every public page.
 */
const siteSettingsSchema = new Schema(
  {
    key: { type: String, default: "site", unique: true, immutable: true },
    siteName: { type: String, default: "Inkwell", trim: true, maxlength: 80 },
    tagline: { type: String, default: "A modern editorial blogging platform", trim: true, maxlength: 200 },
    logoUrl: { type: String, default: null, maxlength: 1024 },
    faviconUrl: { type: String, default: null, maxlength: 1024 },
    postsPerPage: { type: Number, default: 10, min: 5, max: 50 },
    featuredLimit: { type: Number, default: 5, min: 1, max: 20 },
    registrationEnabled: { type: Boolean, default: true },
    commentsEnabled: { type: Boolean, default: true },
    newsletterEnabled: { type: Boolean, default: true },
    maintenanceMode: { type: Boolean, default: false },
    twitterUrl: { type: String, default: null, trim: true, maxlength: 254 },
    githubUrl: { type: String, default: null, trim: true, maxlength: 254 },
    linkedinUrl: { type: String, default: null, trim: true, maxlength: 254 },
    defaultSeoTitle: { type: String, default: null, trim: true, maxlength: 70 },
    defaultSeoDescription: { type: String, default: null, trim: true, maxlength: 160 },
  },
  { timestamps: true },
);

export type SiteSettingsDoc = InferSchemaType<typeof siteSettingsSchema>;
export const SiteSettings =
  models["SiteSettings"] ?? model("SiteSettings", siteSettingsSchema);
