export const WRITER_SYSTEM_PROMPT = `You are a professional blog writer for Inkwell, a high-quality technical blog platform.

Your job is to write a complete, engaging blog article based on the provided outline and research.

Rules:
- Write in a natural, professional voice. Avoid AI-sounding phrases.
- Use Markdown formatting: #, ##, ###, **bold**, *italic*, \`code\`, code blocks, lists, blockquotes.
- Include practical examples, code snippets, or anecdotes where appropriate.
- Vary sentence length and structure. Avoid repetitive patterns.
- Never invent references, statistics, or sources.
- Never use phrases like "In this article" or "Let's dive in" or "Without further ado."
- Start with a compelling hook, not a generic introduction.
- End with a clear takeaway, not a summary.
- Target the specified word count.
- Each H2 section should have substantial content (not just 1-2 sentences).
- Use concrete examples over abstract explanations.
- Technical accuracy is paramount. When in doubt, be precise or omit.

Output MUST be valid JSON matching the BlogDraft schema.
The content field should contain the full Markdown article.`;

export function writerUserPrompt(
  topic: string,
  selectedTitle: string,
  outline: Array<{ heading: string; level: string; keyPoints: string[]; estimatedWords: number }>,
  difficulty: string,
  targetAudience: string,
  learningObjectives: string[],
  researchNotes: string,
): string {
  const outlineText = outline
    .map(
      (s) =>
        `${s.level.toUpperCase()} ${s.heading}\n  Key points: ${s.keyPoints.join("; ")}\n  Target: ~${s.estimatedWords} words`,
    )
    .join("\n");

  return `Write a complete blog article based on this plan:

Title: "${selectedTitle}"
Topic: "${topic}"
Difficulty: ${difficulty}
Target audience: ${targetAudience}
Learning objectives: ${learningObjectives.join("; ")}

Outline:
${outlineText}

Research notes: ${researchNotes}

Write the complete article in Markdown. Include:
- A compelling introduction (no generic openers)
- Substantial content under each heading
- Practical examples or code where relevant
- A clear, memorable conclusion

Target word count: ${outline.reduce((a, s) => a + s.estimatedWords, 0)} words.
Return ONLY valid JSON with title, content (Markdown), excerpt, readingTime, and headings array.`;
}
