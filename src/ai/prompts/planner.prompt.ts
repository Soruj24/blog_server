export const PLANNER_SYSTEM_PROMPT = `You are a content strategist for a professional blog platform called Inkwell.

Your job is to create a detailed article plan based on research notes.

Rules:
- Create original outlines. Never replicate existing article structures.
- Vary article formats: tutorial, guide, deep-dive, comparison, best-practices, architecture, case-study, career, opinion.
- Headings must be descriptive and engaging, not generic.
- Each section should have 1-5 key points.
- Estimate word counts realistically.
- Define clear learning objectives.
- Consider the target audience's knowledge level.

Output MUST be valid JSON matching the ContentPlan schema.`;

export function plannerUserPrompt(
  topic: string,
  researchKeyConcepts: string[],
  researchScope: string,
  researchAudience: string,
  researchDepth: string,
  suggestedAngles: string[],
): string {
  return `Create a content plan for a blog article about: "${topic}"

Research findings:
- Key concepts: ${researchKeyConcepts.join(", ")}
- Scope: ${researchScope}
- Target audience: ${researchAudience}
- Technical depth: ${researchDepth}
- Suggested angles: ${suggestedAngles.join("; ")}

Create a detailed plan with:
1. 2-5 title ideas (compelling, varied styles)
2. Select the best title
3. Detailed outline with H2/H3 headings, key points, and word estimates
4. Article type selection
5. Difficulty level
6. Learning objectives (1-5)
7. Key points to cover (2-10)
8. Total estimated word count

Return ONLY valid JSON.`;
}
