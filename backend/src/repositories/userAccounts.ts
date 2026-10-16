import { randomUUID } from 'crypto';
import { getItem, TxOp } from '../db/dynamo';
import { claimUnique, uniqueKey } from '../db/keys';
import { userRepo } from './index';
import type { IUser, UserRole } from '../types/entities';

// User accounts. Emails are unique: the guard item UNIQUE#EMAIL#<email>
// (holding the user's id) is written in the same transaction as the user.

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const EMAIL_TAKEN = 'Email address is already registered';

// Replacement for User.findOne({ email }).
export const findUserByEmail = async (email: string): Promise<IUser | null> => {
  const guard = await getItem(uniqueKey('EMAIL', normalizeEmail(email)).PK, 'UNIQUE');
  if (!guard?.ownerId) return null;
  return userRepo.get(guard.ownerId);
};

// Creates a user (email guard included). `extra` lets callers create the
// patient/doctor profile and counters in the same transaction, so a failed
// profile insert can never leave an orphan user behind.
export const createUserAccount = async (
  data: { _id?: string; name: string; email: string; password: string; role: UserRole; phone?: string; avatar?: string },
  extra: TxOp[] = []
): Promise<IUser> => {
  const id = data._id ?? randomUUID();
  const email = normalizeEmail(data.email);
  return userRepo.create(
    {
      _id: id,
      name: data.name.trim(),
      email,
      password: data.password,
      role: data.role,
      phone: data.phone ?? '',
      avatar: data.avatar ?? '',
      isActive: true,
    },
    { extra: [claimUnique('EMAIL', email, id, EMAIL_TAKEN), ...extra] }
  );
};
