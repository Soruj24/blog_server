/**
 * User-generated content hygiene. Stored comments are plain text —
 * React escapes on render — but defense in depth strips markup
 * server-side so no stored-XSS payload survives a future raw-HTML
 * consumer (RSS, emails, exports).
 */
export function stripHtml(input: string): string {
  return (
    input
      // Drop executable/style blocks WITH their content first — inner text
      // of <script> is not "content", and keeping it leaks payload text.
      .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
      .replace(/<style[\s\S]*?<\/style\s*>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&lt;|&gt;|&amp;|&quot;|&#x27;|&#39;/g, (entity) => {
        switch (entity) {
          case "&lt;":
            return "<";
          case "&gt;":
            return ">";
          case "&amp;":
            return "&";
          case "&quot;":
          case "&#x27;":
          case "&#39;":
            return "'";
          default:
            return entity;
        }
      })
  );
}

/** Normalize comment body: strip markup, tame whitespace, trim.
 *  Line breaks survive (UI renders pre-wrap); runs of 3+ collapse. */
export function sanitizeText(input: string, maxLength: number): string {
  return stripHtml(input)
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}
