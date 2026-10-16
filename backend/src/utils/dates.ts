import { BadRequestError } from './errors';

// Date helpers. Day boundaries use the server's local time zone, exactly like
// the original code (`setHours(0,0,0,0)`). On Vercel the server runs in UTC.

export const parseDate = (value: unknown, field = 'date'): Date => {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new BadRequestError(`Invalid ${field}`);
  return d;
};

export const toIso = (value: unknown, field = 'date'): string => parseDate(value, field).toISOString();

// [start, end] ISO strings of the local day containing `value`.
export const dayRangeIso = (value: Date | string): [string, string] => {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(value);
  end.setHours(23, 59, 59, 999);
  return [start.toISOString(), end.toISOString()];
};

// "YYYY-MM-DD" of the local day (used in appointment slot-lock keys).
export const localDayKey = (value: Date | string): string => {
  const d = new Date(value);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Upper bound for sort keys of the form "<iso date>#<id>" so BETWEEN includes the whole end instant.
export const isoUpper = (iso: string) => `${iso}#￿`;
