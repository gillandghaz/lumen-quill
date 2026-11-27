export const byteLength = (s: string): number => new TextEncoder().encode(s).length;

/** Remove control characters except tab/newline; normalise newlines. */
export function cleanText(s: string): string {
  return s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
}

export function cleanTitle(s: string): string {
  return cleanText(s).replace(/\s+/g, " ").trim();
}

export function wordCount(s: string): number {
  const m = s.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** First non-empty line, shortened, for list previews. */
/** Plain text of inline Markdown: **bold**, *italic*, _italic_ and `code` lose their markers. */
export function stripInline(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/(^|\W)_([^_]+)_(?=\W|$)/g, "$1$2").replace(/`([^`]+)`/g, "$1");
}

export function preview(s: string, max = 140): string {
  // Leading block markers (heading, quote, list) always end in a space, so "**bold" at the start is left for stripInline.
  const line = s.split("\n").map((l) => stripInline(l.replace(/^\s*(?:(?:#{1,6}|>|[-*+]|\d+[.)])\s+)*/, "")).trim()).find((l) => l.length > 0) ?? "";
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
