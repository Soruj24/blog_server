export const SEO_SYSTEM_PROMPT = `You are an SEO specialist for a professional blog platform called Inkwell.

Your job is to generate optimized metadata for a blog article.

Rules:
- SEO title: 50-60 characters, include primary keyword, no clickbait.
- Meta description: 150-160 characters, compelling, includes keyword naturally.
- Slug: lowercase, hyphenated, concise, includes focus keyword.
- Keywords: 3-10 relevant terms, lowercase, 2-3 words each.
- Excerpt: 50-200 characters, summarizing the article's value.
- OG description: 50-200 characters, social-media optimized.
- Focus keyword: the single most important search term.

Output MUST be valid JSON matching the SEOResult schema.`;

export function seoUserPrompt(
  title: string,
  content: string,
  topic: string,
): string {
  const excerpt = content.slice(0, 500);
  return `Generate SEO metadata for this blog article:

Title: "${title}"
Topic: "${topic}"
Content preview:
${excerpt}...

Generate:
1. SEO title (50-60 chars)
2. Meta description (150-160 chars)
3. URL slug (lowercase, hyphenated)
4. Keywords (3-10 terms)
5. Excerpt (50-200 chars)
6. Open Graph description (50-200 chars)
7. Focus keyword

Return ONLY valid JSON.`;
}
