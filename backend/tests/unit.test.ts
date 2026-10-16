import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { buildCreateTableInput } from '../src/db/table';
import { exactTokens, matchesAllWords, queryWords, uniqueTokens, wordTokens } from '../src/db/search';
import { expandRoles } from '../src/middleware/rbac';
import { errorHandler } from '../src/middleware/errorHandler';
import { isDescending, paginationMeta, parseLimit, queryString } from '../src/utils/pagination';
import { dayRangeIso, isoUpper, localDayKey } from '../src/utils/dates';
import { ConflictError, NotFoundError } from '../src/utils/errors';
import { queryPage } from '../src/db/dynamo';

// Pure unit tests (no database needed).

describe('table definition', () => {
  it('matches the documented single-table layout', () => {
    const input = buildCreateTableInput('HospitalData');
    expect(input.BillingMode).toBe('PAY_PER_REQUEST');
    expect(input.KeySchema).toEqual([
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ]);
    expect(input.GlobalSecondaryIndexes!.map((g) => [g.IndexName, g.KeySchema![0].AttributeName, g.KeySchema![1].AttributeName, g.Projection!.ProjectionType])).toEqual([
      ['GSI1', 'GSI1PK', 'GSI1SK', 'ALL'],
      ['GSI2', 'GSI2PK', 'GSI2SK', 'ALL'],
      ['GSI3', 'GSI3PK', 'GSI3SK', 'ALL'],
    ]);
    expect(input.AttributeDefinitions!.every((a) => a.AttributeType === 'S')).toBe(true);
  });
});

describe('search tokens', () => {
  it('builds word and exact tokens', () => {
    expect(wordTokens('John  Smith-Jones', 'Cardiology (Heart)')).toEqual(['john', 'smith-jones', 'cardiology', 'heart']);
    expect(exactTokens('P-2026-0001', 'John@Example.com', '', undefined)).toEqual(['p-2026-0001', 'john@example.com']);
    expect(uniqueTokens(['a', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('matches every query word as a token prefix', () => {
    const tokens = ['john', 'smith', 'p-2026-0001'];
    expect(matchesAllWords(tokens, 'jo sm')).toBe(true);
    expect(matchesAllWords(tokens, 'P-2026')).toBe(true);
    expect(matchesAllWords(tokens, 'ohn')).toBe(false); // prefix search, not substring
    expect(queryWords('  Foo   BAR ')).toEqual(['foo', 'bar']);
  });
});

describe('role aliases', () => {
  it('lets hospital/super admins pass admin checks and lab_staff pass lab_technician checks', () => {
    expect(expandRoles(['admin'])).toEqual(expect.arrayContaining(['admin', 'super_admin', 'hospital_admin']));
    expect(expandRoles(['lab_technician', 'doctor'])).toEqual(expect.arrayContaining(['lab_technician', 'lab_staff', 'doctor']));
    expect(expandRoles(['patient'])).toEqual(['patient']);
  });
});

describe('pagination and query helpers', () => {
  it('parses limits safely', () => {
    expect(parseLimit(undefined)).toBe(20);
    expect(parseLimit('abc')).toBe(20);
    expect(parseLimit('-5')).toBe(20);
    expect(parseLimit('500', 20, 100)).toBe(100);
    expect(parseLimit('7')).toBe(7);
  });

  it('ignores non-string query values (no operator injection)', () => {
    expect(queryString({ $ne: 'x' })).toBeUndefined();
    expect(queryString(['a', 'b'])).toBeUndefined();
    expect(queryString(' pending ')).toBe('pending');
  });

  it('maps sort strings to a direction', () => {
    expect(isDescending('-date')).toBe(true);
    expect(isDescending('date')).toBe(false);
    expect(isDescending(undefined, false)).toBe(false);
    expect(paginationMeta(10, 3)).toEqual({ limit: 10, count: 3, nextCursor: null, hasMore: false });
  });

  it('rejects malformed cursors with 400 before contacting DynamoDB', async () => {
    await expect(queryPage({ pk: 'TYPE#X', cursor: 'not-a-cursor' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('dates', () => {
  it('computes local-day ranges and keys', () => {
    const [start, end] = dayRangeIso('2030-05-10T12:00:00');
    expect(new Date(start).getHours()).toBe(0);
    expect(new Date(end).getHours()).toBe(23);
    expect(localDayKey('2030-05-10T12:00:00')).toBe('2030-05-10');
    expect(isoUpper('2030-05-10T00:00:00.000Z') > '2030-05-10T00:00:00.000Z#some-id').toBe(true);
  });
});

describe('error handler', () => {
  const app = express();
  app.get('/zod', () => {
    z.object({ name: z.string() }).parse({});
  });
  app.get('/conflict', () => {
    throw new ConflictError('Slot taken');
  });
  app.get('/missing', () => {
    throw new NotFoundError('Nope');
  });
  app.get('/aws', () => {
    const err: any = new Error('Requested resource not found');
    err.name = 'ResourceNotFoundException';
    throw err;
  });
  app.use(errorHandler);

  it('maps errors to proper HTTP statuses', async () => {
    const zod = await request(app).get('/zod');
    expect(zod.status).toBe(400);
    expect(zod.body.errors[0]).toMatchObject({ path: 'name' });
    expect((await request(app).get('/conflict')).status).toBe(409);
    expect((await request(app).get('/missing')).status).toBe(404);
    const aws = await request(app).get('/aws');
    expect(aws.status).toBe(500);
    expect(aws.body.message).toMatch(/table not found/i);
  });
});

describe('CORS allow-list', () => {
  it('allows configured origins (incl. one wildcard) and blocks others', async () => {
    process.env.CLIENT_URL = 'https://hms-web.vercel.app, https://hms-web-*-team.vercel.app';
    const app = (await import('../src/app')).default;
    const ok = await request(app).get('/api/health').set('Origin', 'https://hms-web.vercel.app');
    expect(ok.headers['access-control-allow-origin']).toBe('https://hms-web.vercel.app');
    const preview = await request(app).get('/api/health').set('Origin', 'https://hms-web-git-main-team.vercel.app');
    expect(preview.headers['access-control-allow-origin']).toBe('https://hms-web-git-main-team.vercel.app');
    const evil = await request(app).get('/api/health').set('Origin', 'https://evil.example.com');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    const unknown = await request(app).get('/api/does-not-exist');
    expect(unknown.status).toBe(404);
    expect(unknown.body.success).toBe(false);
  });
});
