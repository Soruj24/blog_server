import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import * as categoryService from "../services/category.service.js";

/** GET /categories — public directory. */
export const listCategories = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, await categoryService.listCategories());
});

/** GET /categories/all — admin (includes hidden). */
export const listAllCategories = asyncHandler(async (_req: Request, res: Response) => {
  return ok(res, await categoryService.listAllCategories());
});

/** POST /categories — admin. */
export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  return ok(res, await categoryService.createCategory(req.body), 201);
});

/** PATCH /categories/:id — admin. */
export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  return ok(
    res,
    await categoryService.updateCategory(req.params["id"] as string, req.body),
  );
});

/** DELETE /categories/:id — admin (?reassignTo moves posts first). */
export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>;
  return ok(
    res,
    await categoryService.removeCategory(req.params["id"] as string, q["reassignTo"]),
  );
});
