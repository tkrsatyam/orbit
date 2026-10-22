/**
 * Parses and normalizes a comma-separated topic tags string into an array of hashtag tokens.
 * Example: "engineering, consensus" -> ["#engineering", "#consensus"]
 * Example: "#engineering, #consensus" -> ["#engineering", "#consensus"]
 */
export function parseTopicTags(rawTags: string | null | undefined): string[] {
  if (!rawTags) {
    return [];
  }

  return rawTags
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)
    .map(t => (t.startsWith('#') ? t : `#${t}`));
}
