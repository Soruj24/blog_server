import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { notFound } from "./middlewares/notFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";

/** Sanitize NoSQL operator injection: strip $ and . from keys */
function mongoSanitize(req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) {
  const sanitize = (obj: unknown): void => {
    if (!obj || typeof obj !== "object") return;
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (key.startsWith("$") || key.includes(".")) {
        delete (obj as Record<string, unknown>)[key];
      } else {
        sanitize((obj as Record<string, unknown>)[key]);
      }
    }
  };
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
}

/** Express app factory — no listen(), no DB here (see index.ts). */
export function createApp() {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://picsum.photos"],
          connectSrc: ["'self'", env.CLIENT_URL],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      crossOriginEmbedderPolicy: false,
    }),
  );
  // Strict CORS — no wildcard
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // same-origin / curl
        if (origin === env.CLIENT_URL) return cb(null, true);
        return cb(new Error("CORS blocked"));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(mongoSanitize);
  // CSRF origin check for state-changing requests
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (["POST", "PATCH", "DELETE", "PUT"].includes(req.method) && origin && origin !== env.CLIENT_URL) {
      return res.status(403).json({ success: false, message: "Forbidden: invalid origin" });
    }
    next();
  });
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ success: false, message: "Too many requests, try again later" }),
  });
  app.use("/api/", limiter);

  app.use("/api/v1", apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
