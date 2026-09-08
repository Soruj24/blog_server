import { z } from "zod";

export const ContentPlanSchema = z.object({
  titleIdeas: z.array(z.string().min(8).max(120)).min(2).max(5),
  selectedTitle: z.string().min(8).max(120),
  outline: z.array(
    z.object({
      heading: z.string().min(5).max(100),
      level: z.enum(["h2", "h3"]),
      keyPoints: z.array(z.string()).min(1).max(5),
      estimatedWords: z.number().min(50).max(1500),
    }),
  ).min(3).max(15),
  targetAudience: z.string(),
  articleType: z.enum([
    "tutorial",
    "guide",
    "deep-dive",
    "comparison",
    "best-practices",
    "architecture",
    "case-study",
    "career",
    "opinion",
  ]),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  learningObjectives: z.array(z.string()).min(1).max(5),
  keyPoints: z.array(z.string()).min(2).max(10),
  estimatedWordCount: z.number().min(500).max(5000),
});

export type ContentPlan = z.infer<typeof ContentPlanSchema>;
