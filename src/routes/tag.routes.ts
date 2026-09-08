import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import {
  createTagSchema,
  deleteTagSchema,
  updateTagSchema,
} from "../validations/taxonomy.validation.js";
import * as tagController from "../controllers/tag.controller.js";

export const tagRouter = Router();

// Public
tagRouter.get("/", tagController.listTags);

// Admin
tagRouter.get("/all", requireAuth, requireRole("admin"), tagController.listAllTags);
tagRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(createTagSchema),
  tagController.createTag,
);
tagRouter.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(updateTagSchema),
  tagController.updateTag,
);
tagRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(deleteTagSchema),
  tagController.deleteTag,
);
