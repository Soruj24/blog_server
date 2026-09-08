import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import {
  createCategorySchema,
  deleteCategorySchema,
  updateCategorySchema,
} from "../validations/taxonomy.validation.js";
import * as categoryController from "../controllers/category.controller.js";

export const categoryRouter = Router();

// Public
categoryRouter.get("/", categoryController.listCategories);

// Admin — static "/all" before any future "/:slug" reads.
categoryRouter.get("/all", requireAuth, requireRole("admin"), categoryController.listAllCategories);
categoryRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(createCategorySchema),
  categoryController.createCategory,
);
categoryRouter.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(updateCategorySchema),
  categoryController.updateCategory,
);
categoryRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(deleteCategorySchema),
  categoryController.deleteCategory,
);
