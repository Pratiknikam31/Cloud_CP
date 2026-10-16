import { AuditLog } from '../models/AuditLog';

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
    if (typeof userIdOrParams === 'object' && userIdOrParams !== null && !userName && !action) {
      const p = userIdOrParams;
      const uName = p.userName || (p.user ? p.user.name : 'System / Guest');
      const uRole = p.userRole || (p.user ? p.user.role : 'system');
      const uId = p.user?.id || p.user?._id || p.user;

      await AuditLog.create({
        user: uId,
        userName: uName,
        userRole: uRole,
        action: p.action,
        entity: p.entity,
        entityId: p.entityId || '',
        description: p.description,
        ipAddress: p.ipAddress || '127.0.0.1',
        timestamp: new Date()
      });
      return;
    }

    // Positional signature
    await AuditLog.create({
      user: userIdOrParams,
      userName: userName || 'System',
      userRole: userRole || 'system',
      action: action || 'UNKNOWN',
      entity: entity || 'General',
      entityId: entityId || '',
      description: description || '',
      ipAddress: ipAddress || '127.0.0.1',
      timestamp: new Date()
    });
  } catch (err: any) {
    console.error('[AuditLog] Error writing audit log:', err.message);
  }
};
