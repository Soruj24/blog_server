import { z } from "zod";

export const EditorialReviewSchema = z.object({
  verdict: z.enum(["PASS", "NEEDS_REVISION"]),
  score: z.number().min(0).max(10),
  feedback: z.object({
    grammar: z.number().min(0).max(10),
    clarity: z.number().min(0).max(10),
    structure: z.number().min(0).max(10),
    engagement: z.number().min(0).max(10),
    technicalAccuracy: z.number().min(0).max(10),
  }),
  issues: z.array(
    z.object({
      type: z.enum(["grammar", "clarity", "structure", "repetition", "engagement", "technical", "formatting"]),
      severity: z.enum(["low", "medium", "high"]),
      description: z.string(),
      suggestion: z.string().optional(),
    }),
  ).default([]),
  revisionNotes: z.string().max(2000).default(""),
});

export type EditorialReview = z.infer<typeof EditorialReviewSchema>;

export const QualityReportSchema = z.object({
  passed: z.boolean(),
  score: z.number().min(0).max(100),
  checks: z.object({
    titleQuality: z.boolean(),
    contentCompleteness: z.boolean(),
    markdownValidity: z.boolean(),
    seoMetadata: z.boolean(),
    noDuplicateConcepts: z.boolean(),
    noExcessiveRepetition: z.boolean(),
    noEmptySections: z.boolean(),
    validFormatting: z.boolean(),
  }),
  issues: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
});

export type QualityReport = z.infer<typeof QualityReportSchema>;
