// Helpers for list endpoints.
//
// DynamoDB has no "skip N items", so lists use cursor pagination:
//   GET /api/appointments?limit=20            -> first page
//   GET /api/appointments?limit=20&cursor=... -> next page (cursor from the previous response)
// Responses keep the `pagination` object; `page`/`skip` are no longer supported.

export const parseLimit = (raw: unknown, defaultLimit = 20, max = 100): number => {
  const n = parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return defaultLimit;
  return Math.min(max, n);
};

export const parseCursor = (raw: unknown): string | undefined =>
  typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;

// Only plain string query values are accepted as filters (?status[$ne]=x and
// arrays are ignored), so query strings cannot inject operators.
export const queryString = (raw: unknown): string | undefined =>
  typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined;

// `sort` strings like "-date" / "date" only choose descending / ascending order
// on the index's own sort key.
export const isDescending = (rawSort: unknown, defaultDescending = true): boolean => {
  const s = queryString(rawSort);
  if (!s) return defaultDescending;
  return s.startsWith('-');
};

export const paginationMeta = (limit: number, count: number, nextCursor?: string) => ({
  limit,
  count,
  nextCursor: nextCursor ?? null,
  hasMore: !!nextCursor,
});
