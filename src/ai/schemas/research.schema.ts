import { z } from "zod";

export const ResearchResultSchema = z.object({
  topic: z.string(),
  keyConcepts: z.array(z.string()).min(3).max(10),
  scope: z.enum(["narrow", "moderate", "broad"]),
  targetAudience: z.string(),
  technicalDepth: z.enum(["beginner", "intermediate", "advanced"]),
  conceptsToExplain: z.array(z.string()).min(2).max(8),
  suggestedAngles: z.array(z.string()).min(1).max(5),
  prerequisites: z.array(z.string()).default([]),
  relatedTopics: z.array(z.string()).default([]),
  notes: z.string().max(2000),
});

export type ResearchResult = z.infer<typeof ResearchResultSchema>;
