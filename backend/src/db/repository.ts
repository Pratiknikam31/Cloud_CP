import { randomUUID } from 'crypto';
import { batchGetItems, getItem, Item, nowIso, putItem, transactWrite, tx, TxOp } from './dynamo';
import { findCandidateIds, matchesAllWords, searchTokenItem, searchTokenKey, uniqueTokens } from './search';
import { KEY_ATTRIBUTES } from './table';
import type { BaseEntity } from '../types/entities';

// A small generic repository. Each entity type is stored as one item:
//   PK = <TYPE>#<_id>, SK = <TYPE>
// plus whatever GSI keys `indexKeys` derives from the entity, a `version` number
// for optimistic locking, and optional search-token items.
//
// Every update is "read, change, write back only if version is unchanged". If
// another request changed the item in between, the write fails and the API
// returns 409, so concurrent updates are never silently lost.

export type IndexKeys = Partial<Record<'GSI1PK' | 'GSI1SK' | 'GSI2PK' | 'GSI2SK' | 'GSI3PK' | 'GSI3SK', string | undefined>>;

export type NewEntity<T extends BaseEntity> = Omit<T, '_id' | 'createdAt' | 'updatedAt'> & Partial<Pick<T, '_id' | 'createdAt'>>;

type ExtraOps<T> = TxOp[] | ((current: T, next: T) => TxOp[]);

export interface EntityConfig<T extends BaseEntity> {
  type: string;
  indexKeys?: (entity: T) => IndexKeys;
  searchTokens?: (entity: T) => string[];
  hiddenFields?: (keyof T)[];
}

const INTERNAL_ATTRIBUTES = new Set<string>([...KEY_ATTRIBUTES, 'entityType', 'version']);

export const VERSION_CONFLICT = 'This record was changed by another request. Please reload and try again.';

export class Repository<T extends BaseEntity> {
  constructor(private readonly config: EntityConfig<T>) {}

  get type() {
    return this.config.type;
  }

  key(id: string) {
    return { PK: `${this.config.type}#${id}`, SK: this.config.type };
  }

  // ---------- conversions ----------

  fromItem(item: Item): T {
    const entity: Item = {};
    for (const [k, v] of Object.entries(item)) {
      if (!INTERNAL_ATTRIBUTES.has(k)) entity[k] = v;
    }
    return entity as T;
  }

  // Shape returned by the API (hidden fields such as password removed).
  toPublic(entity: T): Omit<T, never> {
    if (!this.config.hiddenFields?.length) return entity;
    const copy: Item = { ...entity };
    for (const f of this.config.hiddenFields) delete copy[f as string];
    return copy as T;
  }

  private toItem(entity: T, version: number): Item {
    const indexKeys = this.config.indexKeys?.(entity) ?? {};
    const keys: Item = {};
    // GSI key attributes must be non-empty strings; omit unset ones (sparse index).
    for (const [k, v] of Object.entries(indexKeys)) {
      if (typeof v === 'string' && v !== '') keys[k] = v;
    }
    return { ...entity, ...this.key(entity._id), ...keys, entityType: this.config.type, version };
  }

  private tokens(entity: T): string[] {
    return this.config.searchTokens ? uniqueTokens(this.config.searchTokens(entity)) : [];
  }

  // ---------- reads ----------

  async getWithVersion(id: string): Promise<{ entity: T; version: number } | null> {
    if (!id || typeof id !== 'string') return null;
    const item = await getItem(this.key(id).PK, this.key(id).SK);
    if (!item) return null;
    return { entity: this.fromItem(item), version: Number(item.version ?? 0) };
  }

  async get(id: string): Promise<T | null> {
    return (await this.getWithVersion(id))?.entity ?? null;
  }

  async getMany(ids: (string | undefined | null)[]): Promise<Map<string, T>> {
    const wanted = Array.from(new Set(ids.filter((id): id is string => typeof id === 'string' && id !== '')));
    const items = await batchGetItems(wanted.map((id) => this.key(id)));
    return new Map(items.map((item) => [item._id as string, this.fromItem(item)]));
  }

  // ---------- writes ----------

  // Builds the transaction items for creating an entity without executing them,
  // so several entities can be created atomically in one transactWrite call.
  prepareCreate(data: NewEntity<T>): { entity: T; ops: TxOp[] } {
    const now = nowIso();
    const entity = { ...data, _id: data._id ?? randomUUID(), createdAt: data.createdAt ?? now, updatedAt: now } as T;
    const item = this.toItem(entity, 1);
    const tokenOps = this.tokens(entity).map((t) => tx.put(searchTokenItem(this.config.type, t, entity._id)));
    return { entity, ops: [tx.putUnique(item, 'A record with this id already exists'), ...tokenOps] };
  }

  async create(data: NewEntity<T>, opts: { extra?: TxOp[] } = {}): Promise<T> {
    const { entity, ops } = this.prepareCreate(data);
    const extra = opts.extra ?? [];
    if (ops.length === 1 && extra.length === 0) {
      await putItem(ops[0].Put!.Item as Item, 'A record with this id already exists', { expression: 'attribute_not_exists(PK)' });
    } else {
      await transactWrite([...ops, ...extra]);
    }
    return entity;
  }

  // `change` receives the current entity and returns the fields to change.
  // It may throw (e.g. an AppError) to reject the update based on current state.
  // Returns null if the entity does not exist.
  async update(
    id: string,
    change: (current: T) => Partial<T> | Promise<Partial<T>>,
    opts: { extra?: ExtraOps<T> } = {}
  ): Promise<T | null> {
    const found = await this.getWithVersion(id);
    if (!found) return null;
    const { entity: current, version } = found;
    const patch = await change(current);
    const next = { ...current, ...patch, _id: current._id, createdAt: current.createdAt, updatedAt: nowIso() } as T;

    const oldTokens = new Set(this.tokens(current));
    const newTokens = new Set(this.tokens(next));
    const tokenOps: TxOp[] = [
      ...[...oldTokens].filter((t) => !newTokens.has(t)).map((t) => {
        const k = searchTokenKey(this.config.type, t, id);
        return tx.delete(k.PK, k.SK);
      }),
      ...[...newTokens].filter((t) => !oldTokens.has(t)).map((t) => tx.put(searchTokenItem(this.config.type, t, id))),
    ];
    const extra = typeof opts.extra === 'function' ? opts.extra(current, next) : opts.extra ?? [];

    const item = this.toItem(next, version + 1);
    const versionCheck = 'attribute_exists(PK) AND version = :v';
    if (tokenOps.length === 0 && extra.length === 0) {
      await putItem(item, VERSION_CONFLICT, { expression: versionCheck, values: { ':v': version } });
    } else {
      await transactWrite([tx.put(item, versionCheck, VERSION_CONFLICT, { ':v': version }), ...tokenOps, ...extra]);
    }
    return next;
  }

  // Deletes the entity (and its search tokens). `check` may throw to refuse deletion.
  // Returns the deleted entity, or null if it did not exist.
  async remove(
    id: string,
    opts: { extra?: TxOp[] | ((current: T) => TxOp[]); check?: (current: T) => void } = {}
  ): Promise<T | null> {
    const found = await this.getWithVersion(id);
    if (!found) return null;
    const { entity: current, version } = found;
    opts.check?.(current);
    const key = this.key(id);
    const tokenOps = this.tokens(current).map((t) => {
      const k = searchTokenKey(this.config.type, t, id);
      return tx.delete(k.PK, k.SK);
    });
    const extra = typeof opts.extra === 'function' ? opts.extra(current) : opts.extra ?? [];
    await transactWrite([
      tx.delete(key.PK, key.SK, 'version = :v', { ':v': version }, VERSION_CONFLICT),
      ...tokenOps,
      ...extra,
    ]);
    return current;
  }

  // ---------- search ----------

  // Word-prefix search over this entity's search tokens (see db/search.ts).
  async search(q: string, limit = 20): Promise<T[]> {
    if (!this.config.searchTokens) return [];
    const ids = await findCandidateIds(this.config.type, q, Math.max(limit * 5, 50));
    const found = await this.getMany(ids);
    return [...found.values()].filter((e) => matchesAllWords(this.tokens(e), q)).slice(0, limit);
  }
}
