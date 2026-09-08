import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "./auth.routes.js";
import { userRouter } from "./user.routes.js";
import { articleRouter } from "./article.routes.js";
import { categoryRouter } from "./category.routes.js";
import { newsletterRouter } from "./newsletter.routes.js";
import { tagRouter } from "./tag.routes.js";
import { authorRouter } from "./author.routes.js";
import { followRouter } from "./follows.routes.js";
import { notificationRouter } from "./notification.routes.js";
import { adminRouter } from "./admin.routes.js";
import { mediaRouter } from "./media.routes.js";
import { aiRouter } from "./ai.routes.js";
import { blogGenerationRouter } from "./blog-generation.routes.js";

/**
 * API v1 aggregator. Feature routers mount here in later phases:
 *   /ai, /ai/generate
 */
export const apiRouter = Router();
apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/articles", articleRouter);
apiRouter.use("/categories", categoryRouter);
apiRouter.use("/newsletter", newsletterRouter);
apiRouter.use("/tags", tagRouter);
apiRouter.use("/authors", authorRouter);
apiRouter.use("/follows", followRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/media", mediaRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/ai/generate", blogGenerationRouter);
