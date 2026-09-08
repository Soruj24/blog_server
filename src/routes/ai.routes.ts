import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth, requireRole } from "../middlewares/requireAuth.js";
import { validate } from "../middlewares/validate.js";
import * as v from "../validations/ai.validation.js";
import * as c from "../controllers/ai.controller.js";

const limiter = rateLimit({ windowMs: 60 * 1000, limit: 20, message: { message: "AI rate limit: 20/min" } });

export const aiRouter = Router();
// All AI routes require auth; author+ can use, but we allow any authenticated for now, admin/editor preferred
aiRouter.use(requireAuth);

aiRouter.post("/title", limiter, validate(v.titleSchema), c.generateTitle);
aiRouter.post("/outline", limiter, validate(v.outlineSchema), c.generateOutline);
aiRouter.post("/article", limiter, validate(v.articleSchema), c.generateArticle);
aiRouter.post("/rewrite", limiter, validate(v.rewriteSchema), c.rewrite);
aiRouter.post("/grammar", limiter, validate(v.grammarSchema), c.grammar);
aiRouter.post("/summarize", limiter, validate(v.summarizeSchema), c.summarize);
aiRouter.post("/seo-title", limiter, validate(v.seoTitleSchema), c.seoTitle);
aiRouter.post("/seo-description", limiter, validate(v.seoDescSchema), c.seoDescription);
aiRouter.post("/tags", limiter, validate(v.tagsSchema), c.generateTags);
aiRouter.post("/category", limiter, validate(v.categorySchema), c.suggestCategory);
aiRouter.post("/excerpt", limiter, validate(v.excerptSchema), c.generateExcerpt);
