import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { UserRole } from '../types/entities';

// Role aliases: the routes authorize 'admin' and 'lab_technician', while the
// seeded and registrable accounts use 'hospital_admin' / 'super_admin' and
// 'lab_staff'. Without these aliases those accounts were refused (403) on
// their own screens.
const ROLE_ALIASES: Partial<Record<UserRole, UserRole[]>> = {
  admin: ['super_admin', 'hospital_admin'],
  lab_technician: ['lab_staff'],
};

export const expandRoles = (roles: UserRole[]): UserRole[] =>
  Array.from(new Set(roles.flatMap((r) => [r, ...(ROLE_ALIASES[r] ?? [])])));

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  const allowed = expandRoles(allowedRoles);
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role '${req.user.role}' does not have access to this resource`
      });
    }

    next();
  };
};
