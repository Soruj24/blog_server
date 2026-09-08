import mongoose, { Schema, model, models, type InferSchemaType } from "mongoose";

export const USER_ROLES = ["reader", "author", "editor", "admin"] as const;
export const USER_STATUSES = ["active", "suspended"] as const;

/** Roles allowed to moderate comments (approve/reject/spam/delete-any). */
export const MODERATOR_ROLES = ["editor", "admin"] as const;

/**
 * User = auth identity (small, hot document).
 * Public author data lives in Profile (1-to-1) so auth writes and
 * public reads scale independently.
 *
 * Query patterns: findOne by email (login), by _id (session),
 * list by role+status (admin). All covered below.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    emailVerified: { type: Date, default: null },
    // Null for OAuth-only accounts. Never selected by default.
    passwordHash: { type: String, default: null, select: false },
    role: { type: String, enum: USER_ROLES, default: "reader", index: true },
    status: { type: String, enum: USER_STATUSES, default: "active", index: true },
    image: { type: String, default: null, maxlength: 1024 },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>)["passwordHash"];
        return ret;
      },
    },
  },
);

userSchema.index({ role: 1, status: 1, createdAt: -1 });

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = models["User"] ?? model("User", userSchema);
