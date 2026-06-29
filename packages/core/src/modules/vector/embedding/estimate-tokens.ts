export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  const chars = text.length;
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;

  return Math.max(Math.ceil(chars / 4), Math.ceil(words / 0.75));
}
