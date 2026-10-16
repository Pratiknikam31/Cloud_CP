import { Item, queryPage } from './dynamo';

// Word-prefix search without table scans.
//
// For every searchable entity we store small "token" items:
//   PK = SEARCH#<TYPE>   SK = <token>#<entityId>
// e.g. a patient "John Smith" (P-2026-0004) gets tokens: john, smith, p-2026-0004, ...
// A search for "joh" is a single Query with begins_with(SK, "joh").
// Multi-word searches query by the longest word and then require every word to
// prefix-match one of the entity's tokens.

const TOKEN_CHARS = /[^a-z0-9@._+-]+/g;

export const normalize = (value: string): string => value.toLowerCase().trim();

// Split free text (names, specializations) into word tokens.
export const wordTokens = (...values: (string | undefined | null)[]): string[] =>
  values
    .filter((v): v is string => typeof v === 'string')
    .flatMap((v) => normalize(v).split(/[\s,;/()]+/))
    .map((w) => w.replace(TOKEN_CHARS, ''))
    .filter((w) => w.length > 0);

// Keep identifiers (IDs, emails, phone numbers) as whole tokens.
export const exactTokens = (...values: (string | undefined | null)[]): string[] =>
  values
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map((v) => normalize(v).replace(TOKEN_CHARS, ''))
    .filter((t) => t.length > 0);

export const uniqueTokens = (tokens: string[]): string[] => Array.from(new Set(tokens)).slice(0, 25);

export const searchTokenKey = (type: string, token: string, id: string) => ({
  PK: `SEARCH#${type}`,
  SK: `${token}#${id}`,
});

export const searchTokenItem = (type: string, token: string, id: string): Item => ({
  ...searchTokenKey(type, token, id),
  entityType: 'SEARCH',
  entityId: id,
});

export const queryWords = (q: string): string[] =>
  normalize(q)
    .split(/\s+/)
    .map((w) => w.replace(TOKEN_CHARS, ''))
    .filter(Boolean);

// Returns candidate entity ids whose tokens start with the longest query word.
export const findCandidateIds = async (type: string, q: string, maxCandidates = 100): Promise<string[]> => {
  const words = queryWords(q);
  if (words.length === 0) return [];
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a));
  const { items } = await queryPage({ pk: `SEARCH#${type}`, sk: { beginsWith: longest }, limit: maxCandidates, maxPages: 5 });
  return Array.from(new Set(items.map((i) => i.entityId as string)));
};

// True when every query word is a prefix of at least one of the entity's tokens.
export const matchesAllWords = (tokens: string[], q: string): boolean => {
  const words = queryWords(q);
  return words.every((w) => tokens.some((t) => t.startsWith(w)));
};
