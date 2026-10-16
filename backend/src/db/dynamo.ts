import {
  BatchGetCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  TransactWriteCommand,
  TransactWriteCommandInput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { getDocumentClient } from '../config/aws';
import { env } from '../config/env';
import { INDEXES, IndexName } from './table';
import { BadRequestError, ConflictError } from '../utils/errors';

// Low-level helpers around the DynamoDB Document Client. Every read in the
// application goes through GetItem, BatchGetItem or Query (never Scan).

export type Item = Record<string, any>;
export type TransactItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];
// A transaction item plus the message to show if its condition fails.
export type TxOp = TransactItem & { conflictMessage?: string };

export const tableName = () => env.tableName();
const client = () => getDocumentClient();

export const nowIso = () => new Date().toISOString();

// ---------- single items ----------

export const getItem = async (PK: string, SK: string): Promise<Item | undefined> => {
  const res = await client().send(new GetCommand({ TableName: tableName(), Key: { PK, SK } }));
  return res.Item;
};

export const putItem = async (item: Item, conflictMessage?: string, condition?: { expression: string; values?: Item; names?: Record<string, string> }) => {
  try {
    await client().send(
      new PutCommand({
        TableName: tableName(),
        Item: item,
        ConditionExpression: condition?.expression,
        ExpressionAttributeValues: condition?.values,
        ExpressionAttributeNames: condition?.names,
      })
    );
  } catch (err: any) {
    if (err?.name === 'ConditionalCheckFailedException') throw new ConflictError(conflictMessage);
    throw err;
  }
};

// Fetch many items by key. BatchGetItem accepts at most 100 keys per call and may
// return some keys as "unprocessed" under load, which we retry.
export const batchGetItems = async (keys: { PK: string; SK: string }[]): Promise<Item[]> => {
  const unique = Array.from(new Map(keys.map((k) => [`${k.PK}|${k.SK}`, k])).values());
  const results: Item[] = [];
  for (let i = 0; i < unique.length; i += 100) {
    let pending: Item[] | undefined = unique.slice(i, i + 100);
    for (let attempt = 0; pending && pending.length > 0 && attempt < 5; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      const res: any = await client().send(
        new BatchGetCommand({ RequestItems: { [tableName()]: { Keys: pending } } })
      );
      results.push(...(res.Responses?.[tableName()] ?? []));
      pending = res.UnprocessedKeys?.[tableName()]?.Keys;
    }
    if (pending && pending.length > 0) {
      throw new Error('DynamoDB BatchGetItem left unprocessed keys after retries');
    }
  }
  return results;
};

// ---------- transactions ----------

// Runs up to 100 writes atomically. If any condition fails, the whole
// transaction is rolled back and a 409 ConflictError is thrown with the message
// attached to the failing operation.
export const transactWrite = async (ops: TxOp[], defaultConflictMessage?: string) => {
  if (ops.length === 0) return;
  if (ops.length > 100) throw new Error(`Transaction too large (${ops.length} items; DynamoDB limit is 100)`);
  const TransactItems = ops.map(({ conflictMessage, ...item }) => item as TransactItem);
  try {
    await client().send(new TransactWriteCommand({ TransactItems }));
  } catch (err: any) {
    if (err?.name === 'TransactionCanceledException') {
      const reasons: { Code?: string }[] = err.CancellationReasons ?? [];
      const failedIndex = reasons.findIndex((r) => r?.Code === 'ConditionalCheckFailed');
      if (failedIndex >= 0) {
        throw new ConflictError(ops[failedIndex]?.conflictMessage || defaultConflictMessage);
      }
      if (reasons.some((r) => r?.Code === 'TransactionConflict')) {
        throw new ConflictError('Another request updated the same records at the same time. Please retry.');
      }
    }
    throw err;
  }
};

// Building blocks for transactions.
export const tx = {
  put: (item: Item, condition?: string, conflictMessage?: string, values?: Item): TxOp => ({
    Put: {
      TableName: tableName(),
      Item: item,
      ...(condition ? { ConditionExpression: condition } : {}),
      ...(values ? { ExpressionAttributeValues: values } : {}),
    },
    conflictMessage,
  }),
  // Create an item only if the key is not already taken (uniqueness guard / slot lock).
  putUnique: (item: Item, conflictMessage: string): TxOp => ({
    Put: { TableName: tableName(), Item: item, ConditionExpression: 'attribute_not_exists(PK)' },
    conflictMessage,
  }),
  delete: (PK: string, SK: string, condition?: string, values?: Item, conflictMessage?: string): TxOp => ({
    Delete: {
      TableName: tableName(),
      Key: { PK, SK },
      ...(condition ? { ConditionExpression: condition } : {}),
      ...(values ? { ExpressionAttributeValues: values } : {}),
    },
    conflictMessage,
  }),
  // Atomically add numbers to attributes of a stats item (creates it if missing).
  add: (PK: string, SK: string, deltas: Record<string, number>): TxOp => {
    const entries = Object.entries(deltas).filter(([, v]) => v !== 0 && Number.isFinite(v));
    if (entries.length === 0) entries.push(['touched', 0]);
    return {
      Update: {
        TableName: tableName(),
        Key: { PK, SK },
        UpdateExpression: 'ADD ' + entries.map((_, i) => `#a${i} :v${i}`).join(', '),
        ExpressionAttributeNames: Object.fromEntries(entries.map(([k], i) => [`#a${i}`, k])),
        ExpressionAttributeValues: Object.fromEntries(entries.map(([, v], i) => [`:v${i}`, v])),
      },
    };
  },
};

// Non-transactional version of tx.add (used for best-effort counters such as audit stats).
export const addToItem = async (PK: string, SK: string, deltas: Record<string, number>) => {
  const op = tx.add(PK, SK, deltas).Update!;
  await client().send(new UpdateCommand(op as any));
};

// ---------- atomic sequences (human-readable IDs) ----------

// Returns 1, 2, 3, ... for a named sequence. Safe under concurrency: DynamoDB
// applies the ADD atomically, so two requests never receive the same number.
export const nextSequence = async (name: string): Promise<number> => {
  const res = await client().send(
    new UpdateCommand({
      TableName: tableName(),
      Key: { PK: `COUNTER#${name}`, SK: 'COUNTER' },
      UpdateExpression: 'ADD #v :one SET entityType = :type',
      ExpressionAttributeNames: { '#v': 'value' },
      ExpressionAttributeValues: { ':one': 1, ':type': 'COUNTER' },
      ReturnValues: 'UPDATED_NEW',
    })
  );
  return Number(res.Attributes?.value);
};

// ---------- queries ----------

export interface SortKeyCondition {
  beginsWith?: string;
  between?: [string, string];
  gte?: string;
  lte?: string;
  lt?: string;
}

export interface QueryOptions {
  index?: IndexName; // omit to query the base table
  pk: string;
  sk?: SortKeyCondition;
  forward?: boolean; // true = ascending sort key order (default), false = descending
  limit?: number;
  cursor?: string;
  // Optional extra predicate applied to each returned item. Like a DynamoDB
  // FilterExpression it narrows results but does not reduce read cost, so
  // it is only used inside an already key-bounded Query.
  filter?: (item: Item) => boolean;
  maxPages?: number;
}

const keyAttributes = (index?: IndexName) => {
  const attrs = ['PK', 'SK'];
  if (index) attrs.push(INDEXES[index].pk, INDEXES[index].sk);
  return attrs;
};

const encodeCursor = (item: Item, index?: IndexName): string => {
  const key = Object.fromEntries(keyAttributes(index).map((a) => [a, item[a]]));
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
};

const decodeCursor = (cursor: string, index?: IndexName): Item => {
  try {
    const key = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const expected = keyAttributes(index);
    const valid =
      key && typeof key === 'object' &&
      Object.keys(key).length === expected.length &&
      expected.every((a) => typeof key[a] === 'string');
    if (!valid) throw new Error('bad shape');
    return key;
  } catch {
    throw new BadRequestError('Invalid pagination cursor');
  }
};

const buildQueryInput = (opts: QueryOptions): QueryCommandInput => {
  const pkAttr = opts.index ? INDEXES[opts.index].pk : 'PK';
  const skAttr = opts.index ? INDEXES[opts.index].sk : 'SK';
  const names: Record<string, string> = { '#pk': pkAttr };
  const values: Item = { ':pk': opts.pk };
  let expression = '#pk = :pk';
  const sk = opts.sk;
  if (sk) {
    names['#sk'] = skAttr;
    if (sk.beginsWith !== undefined) {
      expression += ' AND begins_with(#sk, :skp)';
      values[':skp'] = sk.beginsWith;
    } else if (sk.between) {
      expression += ' AND #sk BETWEEN :ska AND :skb';
      values[':ska'] = sk.between[0];
      values[':skb'] = sk.between[1];
    } else if (sk.gte !== undefined) {
      expression += ' AND #sk >= :ska';
      values[':ska'] = sk.gte;
    } else if (sk.lte !== undefined) {
      expression += ' AND #sk <= :ska';
      values[':ska'] = sk.lte;
    } else if (sk.lt !== undefined) {
      expression += ' AND #sk < :ska';
      values[':ska'] = sk.lt;
    } else {
      delete names['#sk'];
    }
  }
  return {
    TableName: tableName(),
    IndexName: opts.index,
    KeyConditionExpression: expression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ScanIndexForward: opts.forward ?? true,
  };
};

// Returns one page of results plus an opaque cursor for the next page (if any).
export const queryPage = async (opts: QueryOptions): Promise<{ items: Item[]; nextCursor?: string }> => {
  const limit = Math.max(1, opts.limit ?? 20);
  const maxPages = opts.maxPages ?? 20;
  const input = buildQueryInput(opts);
  let startKey: Item | undefined = opts.cursor ? decodeCursor(opts.cursor, opts.index) : undefined;
  const items: Item[] = [];

  for (let page = 0; page < maxPages; page++) {
    const pageSize = opts.filter ? Math.min(200, Math.max(50, limit * 2)) : limit - items.length;
    const res = await client().send(new QueryCommand({ ...input, Limit: pageSize, ExclusiveStartKey: startKey }));
    const pageItems = res.Items ?? [];
    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];
      if (opts.filter && !opts.filter(item)) continue;
      items.push(item);
      if (items.length === limit) {
        const moreRemain = i < pageItems.length - 1 || !!res.LastEvaluatedKey;
        return { items, nextCursor: moreRemain ? encodeCursor(item, opts.index) : undefined };
      }
    }
    if (!res.LastEvaluatedKey) return { items };
    startKey = res.LastEvaluatedKey;
  }
  // Read budget reached: return what we have and let the client continue from here.
  return { items, nextCursor: encodeCursor(startKey!, opts.index) };
};

// Reads every page of a query. Only used for small, bounded collections
// (departments, lab tests, medicines, rooms, beds, a patient's own history).
export const queryAll = async (opts: Omit<QueryOptions, 'limit' | 'cursor' | 'maxPages'>, maxItems = 5000): Promise<Item[]> => {
  const input = buildQueryInput(opts);
  const items: Item[] = [];
  let startKey: Item | undefined;
  do {
    const res = await client().send(new QueryCommand({ ...input, ExclusiveStartKey: startKey }));
    for (const item of res.Items ?? []) {
      if (!opts.filter || opts.filter(item)) items.push(item);
    }
    startKey = res.LastEvaluatedKey;
    if (items.length >= maxItems) {
      console.warn(`[DynamoDB] queryAll stopped at ${maxItems} items for ${opts.pk}; results truncated`);
      break;
    }
  } while (startKey);
  return items;
};

// Counts items matching a key condition without transferring them (Select COUNT).
export const queryCount = async (opts: Omit<QueryOptions, 'limit' | 'cursor' | 'maxPages' | 'filter' | 'forward'>): Promise<number> => {
  const input = buildQueryInput(opts);
  let count = 0;
  let startKey: Item | undefined;
  do {
    const res = await client().send(new QueryCommand({ ...input, Select: 'COUNT', ExclusiveStartKey: startKey }));
    count += res.Count ?? 0;
    startKey = res.LastEvaluatedKey;
  } while (startKey);
  return count;
};
