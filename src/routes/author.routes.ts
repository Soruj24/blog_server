import { Router } from "express";
import { validate } from "../middlewares/validate.js";
import { authorUsernameSchema } from "../validations/author.validation.js";
import * as authorController from "../controllers/author.controller.js";

export const authorRouter = Router();
authorRouter.get("/:username", validate(authorUsernameSchema), authorController.getAuthorProfile);
