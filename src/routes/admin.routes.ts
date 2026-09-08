import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import {
  adminCommentsSchema,
  adminMediaSchema,
  adminNewsletterSchema,
  adminPostsSchema,
  analyticsSchema,
  bulkCommentsSchema,
  bulkPostsSchema,
  bulkUsersSchema,
  updateSettingsSchema,
} from "../validations/admin.validation.js";
import { updateSubscriberSchema } from "../validations/newsletter.validation.js";
import { z } from "zod";
import * as adminController from "../controllers/admin.controller.js";

const idParams = z.object({
  params: z.object({ id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id") }),
});

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole("admin"));

adminRouter.get("/stats", adminController.getStats);
adminRouter.get("/posts", validate(adminPostsSchema), adminController.listPosts);
adminRouter.patch("/posts/bulk", validate(bulkPostsSchema), adminController.bulkPosts);
adminRouter.get("/comments", validate(adminCommentsSchema), adminController.listComments);
adminRouter.patch("/comments/bulk", validate(bulkCommentsSchema), adminController.bulkComments);
adminRouter.get("/media", validate(adminMediaSchema), adminController.listMedia);
adminRouter.delete("/media/:id", validate(idParams), adminController.deleteMedia);
adminRouter.get("/newsletter", validate(adminNewsletterSchema), adminController.listSubscribers);
adminRouter.patch(
  "/newsletter/:id",
  validate(updateSubscriberSchema),
  adminController.updateSubscriber,
);
adminRouter.delete("/newsletter/:id", validate(idParams), adminController.deleteSubscriber);
adminRouter.patch("/users/bulk", validate(bulkUsersSchema), adminController.bulkUsers);
adminRouter.get("/settings", adminController.getSettings);
adminRouter.patch("/settings", validate(updateSettingsSchema), adminController.updateSettings);
adminRouter.get("/analytics", validate(analyticsSchema), adminController.getAnalytics);
