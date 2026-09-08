import { Router } from "express";
import type { NextFunction, Response } from "express";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import {
  adminUpdateUserSchema,
  listUsersSchema,
  myBookmarksSchema,
  popularAuthorsSchema,
  updateMeSchema,
  updateProfileSchema,
  userByIdSchema,
  userByUsernameSchema,
} from "../validations/user.validation.js";
import * as userController from "../controllers/user.controller.js";

/** Self or admin: users may read their own doc; anyone else needs admin. */
function selfOrAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.userId === req.params["id"] || req.userRole === "admin") return next();
  return next({ status: 403, message: "Forbidden" });
}

export const userRouter = Router();

// Public
userRouter.get(
  "/by-username/:username",
  validate(userByUsernameSchema),
  userController.getByUsername,
);
userRouter.get(
  "/authors/popular",
  validate(popularAuthorsSchema),
  userController.popularAuthors,
);

// Authenticated self
userRouter.get("/me", requireAuth, userController.getMe);
userRouter.get("/me/stats", requireAuth, userController.getMyStats);
userRouter.get(
  "/me/bookmarks",
  requireAuth,
  validate(myBookmarksSchema),
  userController.listMyBookmarks,
);
userRouter.patch("/me", requireAuth, validate(updateMeSchema), userController.updateMe);
userRouter.patch(
  "/me/profile",
  requireAuth,
  validate(updateProfileSchema),
  userController.updateProfile,
);

// Self-or-admin + admin-only (order: specific admin list before :id)
userRouter.get(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(listUsersSchema),
  userController.listUsers,
);
userRouter.get(
  "/:id",
  requireAuth,
  validate(userByIdSchema),
  selfOrAdmin,
  userController.getById,
);
userRouter.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate(adminUpdateUserSchema),
  userController.adminUpdateUser,
);
