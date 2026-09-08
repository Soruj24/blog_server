import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/ApiResponse.js";
import { aiService } from "../services/ai.service.js";
import { aiStream } from "../config/ai.js";

function wantsStream(req: Request): boolean {
  return req.query["stream"] === "true" || req.headers.accept?.includes("text/event-stream") || false;
}

async function handleWithStream(
  req: Request,
  res: Response,
  promptFn: () => string,
  streamFn: () => AsyncGenerator<{ text: string; done: boolean }>,
  nonStreamFn: () => Promise<{ result: string; inputTokens: number; outputTokens: number; total: number; hint: string }>,
) {
  if (!wantsStream(req)) {
    const r = await nonStreamFn();
    return ok(res, r);
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });
  try {
    for await (const chunk of streamFn()) {
      if (aborted) break;
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
      res.end();
    }
  }
}

export const generateTitle = asyncHandler(async (req: Request, res: Response) => {
  const { topic } = req.body as { topic: string };
  return ok(res, await aiService.generateTitle(topic));
});

export const generateOutline = asyncHandler(async (req: Request, res: Response) => {
  const { topic } = req.body as { topic: string };
  return ok(res, await aiService.generateOutline(topic));
});

export const generateArticle = asyncHandler(async (req: Request, res: Response) => {
  const { topic, outline } = req.body as { topic: string; outline?: string };
  if (wantsStream(req)) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    let aborted = false;
    req.on("close", () => (aborted = true));
    const stream = aiService.streamArticle(topic, outline);
    try {
      for await (const c of stream) {
        if (aborted) break;
        res.write(`data: ${JSON.stringify(c)}\n\n`);
        if (c.done) break;
      }
      res.end();
    } catch (e) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`);
        res.end();
      }
    }
    return;
  }
  return ok(res, await aiService.generateArticle(topic, outline));
});

export const rewrite = asyncHandler(async (req: Request, res: Response) => {
  const { content, instruction } = req.body as { content: string; instruction?: string };
  return ok(res, await aiService.rewrite(content, instruction));
});

export const grammar = asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body as { content: string };
  return ok(res, await aiService.improveGrammar(content));
});

export const summarize = asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body as { content: string };
  return ok(res, await aiService.summarize(content));
});

export const seoTitle = asyncHandler(async (req: Request, res: Response) => {
  const { title } = req.body as { title: string };
  return ok(res, await aiService.seoTitle(title));
});

export const seoDescription = asyncHandler(async (req: Request, res: Response) => {
  const { excerpt } = req.body as { excerpt: string };
  return ok(res, await aiService.seoDescription(excerpt));
});

export const generateTags = asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body as { content: string };
  return ok(res, await aiService.generateTags(content));
});

export const suggestCategory = asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body as { content: string };
  return ok(res, await aiService.suggestCategory(content));
});

export const generateExcerpt = asyncHandler(async (req: Request, res: Response) => {
  const { content } = req.body as { content: string };
  return ok(res, await aiService.generateExcerpt(content));
});
