import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { User } from "../models/User.js";
import { Profile } from "../models/Profile.js";
import { ApiError } from "../utils/ApiError.js";
import { signApiToken } from "./token.service.js";
import type { LoginInput, RegisterInput } from "../validations/auth.validation.js";

export interface AuthPayload {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    image: string | null;
    username: string;
  };
  token: string;
}

function sanitizeUsername(raw: string): string {
  const clean = raw.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
  return clean.length >= 3 ? clean : `user_${clean}`;
}

async function uniqueUsername(base: string): Promise<string> {
  let candidate = sanitizeUsername(base);
  // Bounded retries — suffix space (2^32) makes collision exhaustion impossible.
  for (let i = 0; i < 5; i++) {
    const taken = await Profile.exists({ username: candidate });
    if (!taken) return candidate;
    candidate = `${sanitizeUsername(base)}_${crypto.randomInt(1000, 9999)}`;
  }
  return `user_${crypto.randomUUID().slice(0, 8)}`;
}

function toAuthPayload(
  user: { _id: unknown; name: string; email: string; role: string; image?: string | null },
  username: string,
  token: string,
): AuthPayload {
  return {
    user: {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image ?? null,
      username,
    },
    token,
  };
}

/**
 * Register: hashes password (bcrypt 12), creates User + Profile.
 * First account in the DB becomes admin (bootstrap); everything after is reader.
 */
export async function register(input: RegisterInput): Promise<AuthPayload> {
  const existing = await User.exists({ email: input.email });
  if (existing) throw new ApiError(409, "Email already registered");

  const username = input.username
    ? sanitizeUsername(input.username)
    : await uniqueUsername(input.name.split(" ")[0] ?? input.email.split("@")[0] ?? "user");
  if (input.username) {
    const taken = await Profile.exists({ username });
    if (taken) throw new ApiError(409, "Username already taken");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const isFirstUser = (await User.estimatedDocumentCount()) === 0;

  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash,
    role: isFirstUser ? "admin" : "reader",
  });
  await Profile.create({ user: user._id, username, displayName: input.name });

  const token = await signApiToken({
    userId: String(user._id),
    email: user.email,
    role: user.role,
  });
  return toAuthPayload(user, username, token);
}

/** Login: verifies password, rejects suspended accounts, rotates lastLoginAt. */
export async function login(input: LoginInput): Promise<AuthPayload> {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user || !user.passwordHash) throw new ApiError(401, "Invalid credentials");

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new ApiError(401, "Invalid credentials");
  if (user.status === "suspended") throw new ApiError(403, "Account suspended");

  user.lastLoginAt = new Date();
  await user.save();

  const profile = await Profile.findOne({ user: user._id }).select("username");
  const token = await signApiToken({
    userId: String(user._id),
    email: user.email,
    role: user.role,
  });
  return toAuthPayload(user, profile?.username ?? "", token);
}
