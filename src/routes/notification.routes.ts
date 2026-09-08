import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import {
  announceSchema,
  listNotificationsSchema,
  markReadSchema,
} from "../validations/notification.validation.js";
import * as notificationController from "../controllers/notification.controller.js";

export const notificationRouter = Router();
// NOTE: "/read-all" and "/announce" before "/:id/read" — order matters.
notificationRouter.post(
  "/announce",
  requireAuth,
  requireRole("admin"),
  validate(announceSchema),
  notificationController.announce,
);
notificationRouter.get(
  "/",
  requireAuth,
  validate(listNotificationsSchema),
  notificationController.listNotifications,
);
notificationRouter.patch("/read-all", requireAuth, notificationController.markAllRead);
notificationRouter.patch(
  "/:id/read",
  requireAuth,
  validate(markReadSchema),
  notificationController.markRead,
);
