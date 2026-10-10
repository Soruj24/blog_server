export const RESEARCH_SYSTEM_PROMPT = `You are a research analyst for a professional blog platform called Inkwell.

Your job is to analyze a topic and produce structured research notes that will guide content creation.

Rules:
- Produce ORIGINAL analysis. Never copy existing articles or blog posts.
- Never cite specific URLs, authors, or publications.
- Focus on concepts, frameworks, and mental models — not news or current events.
- Identify what the target audience needs to learn.
- Determine the appropriate technical depth.
- Suggest unique angles that differentiate from generic coverage.

Output MUST be va  lid JSON matching the ResearchResult schema.`;

export function researchUserPrompt(topic: string, context?: string): string {
  return `Analyze the following topic for a professional blog article:

Topic: "${topic}"
${context ? `Additional context: ${context}` : ""}

Produce structured research notes covering:
1. Key concepts (3-10 core ideas)
2. Scope assessment (narrow/moderate/broad)
3. Target audience identification
4. Technical depth required
5. Concepts that should be explained
6. Suggested article angles (unique perspectives)
7. Prerequisites readers should know
8. Related topics for internal linking
9. Brief research notes

Return ONLY valid JSON.`;
}
