import { Router } from "express";
import rateLimit from "express-rate-limit";
import { validate } from "../middlewares/validate.js";
import { loginSchema, registerSchema } from "../validations/auth.validation.js";
import * as authController from "../controllers/auth.controller.js";

// Brute-force guard: auth endpoints are the most abused surface.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20 });

export const authRouter = Router();
authRouter.post("/register", authLimiter, validate(registerSchema), authController.register);
authRouter.post("/login", authLimiter, validate(loginSchema), authController.login);
