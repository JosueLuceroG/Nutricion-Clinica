export const CITATION_PATTERN = /\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;

export function extractCitations(content: string): string[] {
  const matches = content.match(CITATION_PATTERN) ?? [];
  return matches.map((match) => match.slice(1, -1).toLowerCase());
}

export interface CitationVerification {
  ok: boolean;
  cited: string[];
  verified: string[];
  missing: string[];
}

export function verifyCitations(input: { content: string; retrievedDocIds: string[] }): CitationVerification {
  const cited = extractCitations(input.content);
  const retrieved = new Set(input.retrievedDocIds.map((id) => id.toLowerCase()));
  const verified = cited.filter((id) => retrieved.has(id));
  const missing = cited.filter((id) => !retrieved.has(id));
  return { ok: missing.length === 0, cited, verified, missing };
}