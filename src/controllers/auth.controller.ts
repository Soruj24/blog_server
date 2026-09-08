import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import * as authService from "../services/auth.service.js";

/** POST /auth/register (public, rate-limited). */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);
  return ok(res, result, 201);
});

/** POST /auth/login (public, rate-limited). */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body);
  return ok(res, result);
});
