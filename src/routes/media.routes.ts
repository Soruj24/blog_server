import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middlewares/requireAuth.js";
import { uploadSingle } from "../middlewares/upload.js";
import { validate } from "../middlewares/validate.js";
import { listMediaSchema, mediaIdSchema, updateMediaSchema } from "../validations/media.validation.js";
import * as postWriteController from "../controllers/postWrite.controller.js";
import * as mediaController from "../controllers/media.controller.js";

const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

export const mediaRouter = Router();

mediaRouter.get("/", requireAuth, validate(listMediaSchema), mediaController.listMyMedia);
mediaRouter.post("/upload", requireAuth, uploadLimiter, uploadSingle("image"), postWriteController.uploadCover);
mediaRouter.get("/:id", requireAuth, validate(mediaIdSchema), mediaController.getMedia);
mediaRouter.patch("/:id", requireAuth, validate(updateMediaSchema), mediaController.updateMedia);
mediaRouter.delete("/:id", requireAuth, validate(mediaIdSchema), mediaController.deleteMedia);
