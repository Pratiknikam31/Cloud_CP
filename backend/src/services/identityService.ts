import { getItem } from '../db/dynamo';
import { uniqueKey, UniqueKind } from '../db/keys';
import { userRepo } from '../repositories';
import { ConflictError } from '../utils/errors';

// Small helpers shared by the patient, doctor and department controllers.

// Zod's .partial() schemas may contain keys whose value is undefined. Writing
// those would erase stored fields, so only defined values become the patch
// (same effect as Mongoose ignoring undefined in Object.assign / $set).
export const definedFields = <T extends Record<string, any>>(data: T): Partial<T> =>
  Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<T>;

// True when a uniqueness guard (UNIQUE#<kind>#<value>) exists and belongs to
// another record. Used after a failed transaction: when two requests race for
// the same value, DynamoDB may cancel the loser with a "TransactionConflict"
// instead of a failed condition, so we look at the guard to decide whether the
// value is really taken (-> the original 400 message) or the request should
// simply be retried (-> 409).
export const isTakenByOther = async (kind: UniqueKind, value: string | undefined, selfId: string): Promise<boolean> => {
  if (!value) return false;
  const guard = await getItem(uniqueKey(kind, value).PK, 'UNIQUE');
  return !!guard && guard.ownerId !== selfId;
};

// Copies a changed name/phone to the linked user account (as the original code did).
// The user item is versioned, so a concurrent change (e.g. lastLogin on login)
// makes the write fail with 409; we simply re-read and retry a few times.
export const syncUserNamePhone = async (userId: string, data: { name?: string; phone?: string }) => {
  if (!data.name && !data.phone) return;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await userRepo.update(userId, () => ({
        ...(data.name && { name: data.name.trim() }),
        ...(data.phone && { phone: data.phone }),
      }));
      return;
    } catch (err) {
      if (!(err instanceof ConflictError) || attempt === 2) throw err;
    }
  }
};
