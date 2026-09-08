import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middlewares/validate.js";
import {
  subscribeSchema,
  unsubscribeSchema,
} from "../validations/newsletter.validation.js";
import * as newsletterController from "../controllers/newsletter.controller.js";

// Signup endpoints attract bots — same guard as /auth.
const newsletterLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });

export const newsletterRouter = Router();
newsletterRouter.post(
  "/subscribe",
  newsletterLimiter,
  validate(subscribeSchema),
  newsletterController.subscribe,
);
newsletterRouter.post(
  "/unsubscribe",
  newsletterLimiter,
  validate(unsubscribeSchema),
  newsletterController.unsubscribe,
);
