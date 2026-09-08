import { SignJWT } from "jose";
import { env } from "../config/env.js";

const secret = () => new TextEncoder().encode(env.AUTH_SECRET);

/**
 * API bearer tokens (HS256, 7 days). Signed with the SAME AUTH_SECRET that
 * Auth.js uses, so:
 * - Auth.js Credentials provider stores this token in its JWT session,
 * - Express requireAuth verifies it with jose — no shared session store,
 *   no extra round-trips. Either side can be scaled/restarted freely.
 */
export async function signApiToken(input: {
  userId: string;
  email: string;
  role: string;
}): Promise<string> {
  return new SignJWT({ email: input.email, role: input.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}
