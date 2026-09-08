import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

/**
 * Zod validation factory. Use per-route:
 *   router.post("/", validate(createArticleSchema), controller)
 * Rejects bad input with 400 before any business logic runs.
 * On success, replaces req.* with sanitized parsed data to prevent mass assignment / injection.
 */
export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      return next({
        status: 400,
        message: "Validation failed",
        details: result.error.flatten(),
      });
    }
    // Overwrite with sanitized data (unknown keys stripped, types coerced)
    const data = result.data as { body?: unknown; query?: unknown; params?: unknown };
    if (data.body !== undefined) (req as unknown as { body: unknown }).body = data.body;
    if (data.query !== undefined) Object.defineProperty(req, "query", { value: data.query, writable: true, configurable: true });
    if (data.params !== undefined) (req as unknown as { params: unknown }).params = data.params;
    next();
  };
}
