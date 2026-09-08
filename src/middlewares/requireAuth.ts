import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import { env } from "../config/env.js";

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

/**
 * Verifies the Auth.js JWT via Authorization: Bearer only.
 * Removed insecure cookie fallback (CSRF via auto-sent cookies).
 * Same AUTH_SECRET on both sides (Auth.js & Express).
 */
export async function requireAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) {
      return next({ status: 401, message: "Unauthorized" });
    }
    if (token.length > 2048) {
      return next({ status: 401, message: "Invalid token" });
    }

    const secret = new TextEncoder().encode(env.AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub || typeof payload.sub !== "string") {
      return next({ status: 401, message: "Invalid token payload" });
    }
    req.userId = payload.sub;
    req.userRole = (payload["role"] as string | undefined) ?? "reader";
    next();
  } catch {
    next({ status: 401, message: "Invalid or expired token" });
  }
}

/** Role gate — composes after requireAuth: requireRole("admin"). */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.userId || !roles.includes(req.userRole ?? "")) {
      return next({ status: 403, message: "Forbidden" });
    }
    next();
  };
}

/** Moderation gate — admins and editors (composes after requireAuth). */
export function requireModerator(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.userId || (req.userRole !== "admin" && req.userRole !== "editor")) {
    return next({ status: 403, message: "Moderator role required" });
  }
  next();
}

/**
 * Best-effort auth: attaches userId/userRole when a valid token is
 * present, never rejects. For public endpoints that personalize
 * (own pending items, liked flags) without gating.
 */
export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return next();
    const secret = new TextEncoder().encode(env.AUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    req.userId = payload.sub;
    req.userRole = (payload["role"] as string | undefined) ?? "reader";
    next();
  } catch {
    next();
  }
}
