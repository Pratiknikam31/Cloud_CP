import type { Repository } from './repository';
import type { BaseEntity } from '../types/entities';

// Replacement for Mongoose `.populate(field, select)`.
// Collects the referenced ids from all documents, loads them with one
// BatchGetItem, and replaces each id with `{ _id, ...selectedFields }`
// (or null when the referenced record no longer exists, like Mongoose).
//
// Example:
//   await populate(appointments, 'patient', patientRepo, ['patientId', 'name']);
//   await populate(appointments.map(a => a.doctor), 'department', departmentRepo, ['name', 'code']);
export async function populate<R extends BaseEntity>(
  docs: any[],
  field: string,
  repo: Repository<R>,
  select?: string[]
): Promise<void> {
  const targets = docs.filter((d) => d && typeof d === 'object');
  const ids = targets.map((d) => d[field]).filter((v) => typeof v === 'string' && v !== '');
  if (ids.length === 0) return;
  const found = await repo.getMany(ids);
  for (const doc of targets) {
    const id = doc[field];
    if (typeof id !== 'string' || id === '') continue;
    const ref = found.get(id);
    if (!ref) {
      doc[field] = null;
      continue;
    }
    const publicRef = repo.toPublic(ref) as Record<string, any>;
    doc[field] = select
      ? Object.fromEntries([['_id', ref._id], ...select.filter((f) => f in publicRef).map((f) => [f, publicRef[f]])])
      : { ...publicRef };
  }
}
