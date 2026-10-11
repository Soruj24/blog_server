import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import * as authorService from "../services/author.service.js";

/** GET /authors/:username */
export const getAuthorProfile = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await authorService.getAuthorProfile(req.params["username"] as string));
});

/** GET /authors — public directory (must sit above nothing: exact "/" only). */
export const listAuthors = asyncHandler(async (req: Request, res: Response) => {
  // validate(listAuthorsSchema) replaces req.query with coerced {page,limit}.
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  return ok(res, await authorService.listAuthors(page, limit));
});
