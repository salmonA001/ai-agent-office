/** Word count that also works for Thai, which doesn't put spaces between words. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    let n = 0;
    for (const s of new Intl.Segmenter(undefined, { granularity: "word" }).segment(trimmed)) if (s.isWordLike) n++;
    return n;
  }
  return trimmed.split(/\s+/).length;
}
