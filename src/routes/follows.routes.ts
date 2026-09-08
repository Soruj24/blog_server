import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import { followStateSchema, followToggleSchema } from "../validations/follow.validation.js";
import * as followController from "../controllers/follow.controller.js";

const followLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60 });

export const followRouter = Router();
followRouter.get(
  "/:username/state",
  requireAuth,
  validate(followStateSchema),
  followController.followState,
);
followRouter.post(
  "/:username/toggle",
  followLimiter,
  requireAuth,
  validate(followToggleSchema),
  followController.toggleFollow,
);
