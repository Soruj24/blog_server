import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import * as authorService from "../services/author.service.js";

/** GET /authors/:username */
export const getAuthorProfile = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await authorService.getAuthorProfile(req.params["username"] as string));
});
