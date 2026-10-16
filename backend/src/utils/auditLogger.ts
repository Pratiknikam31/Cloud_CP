import { auditLogRepo } from '../repositories';
import { addToItem, nowIso } from '../db/dynamo';
import { STATS } from '../db/keys';

// Writes an audit log entry and bumps the per-action / per-entity counters used
// by GET /api/audit-logs/stats. Failures are logged and swallowed so auditing
// never breaks the main request (same behaviour as before).
//
// Two call styles are supported, as before:
//   logAudit({ user, action, entity, entityId, description, ipAddress })
//   logAudit(userId, userName, userRole, action, entity, entityId, description, ipAddress)
export const logAudit = async (
  userIdOrParams: any,
  userName?: string,
  userRole?: string,
  action?: string,
  entity?: string,
  entityId?: string,
  description?: string,
  ipAddress?: string
) => {
  try {
    let entry: {
      user?: string;
      userName: string;
      userRole: string;
      action: string;
      entity: string;
      entityId: string;
      description: string;
      ipAddress: string;
    };

    if (typeof userIdOrParams === 'object' && userIdOrParams !== null && !userName && !action) {
      const p = userIdOrParams;
      const uId = p.user?.id || p.user?._id || (typeof p.user === 'string' ? p.user : undefined);
      entry = {
        user: uId ? String(uId) : undefined,
        userName: p.userName || (p.user ? p.user.name : 'System / Guest'),
        userRole: p.userRole || (p.user ? p.user.role : 'system'),
        action: p.action,
        entity: p.entity,
        entityId: p.entityId || '',
        description: p.description,
        ipAddress: p.ipAddress || '127.0.0.1',
      };
    } else {
      entry = {
        user: userIdOrParams ? String(userIdOrParams) : undefined,
        userName: userName || 'System',
        userRole: userRole || 'system',
        action: action || 'UNKNOWN',
        entity: entity || 'General',
        entityId: entityId || '',
        description: description || '',
        ipAddress: ipAddress || '127.0.0.1',
      };
    }

    await auditLogRepo.create({ ...entry, timestamp: nowIso() });
    await Promise.all([
      addToItem(STATS.auditAction(entry.action).PK, STATS.auditAction(entry.action).SK, { count: 1 }),
      addToItem(STATS.auditEntity(entry.entity).PK, STATS.auditEntity(entry.entity).SK, { count: 1 }),
    ]);
  } catch (err: any) {
    console.error('[AuditLog] Error writing audit log:', err.message);
  }
};
