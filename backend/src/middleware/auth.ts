import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types/entities';
import { env } from '../config/env';
import { userRepo } from '../repositories';

export interface AuthUser {
  id: string;
  _id: string;
  role: UserRole;
  email: string;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authenticateJWT = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    // No fallback secret: if JWT_SECRET is missing this throws a ConfigError (500)
    // instead of silently accepting tokens signed with a publicly known key.
    let secret: string;
    try {
      secret = env.jwtSecret();
    } catch (err) {
      return next(err);
    }

    try {
      const decoded = jwt.verify(token, secret) as any;
      const userId = decoded._id || decoded.id || '';
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Invalid token: user ID missing' });
      }

      // Re-verify against database: ensures user exists, account is active, and role is authoritative
      const user = await userRepo.get(userId);
      if (!user) {
        return res.status(401).json({ success: false, message: 'User account not found' });
      }
      if (user.isActive === false) {
        return res.status(403).json({ success: false, message: 'Account has been deactivated. Please contact an administrator.' });
      }

      req.user = {
        ...decoded,
        id: user._id,
        _id: user._id,
        role: user.role,
        email: user.email,
        name: user.name,
      };
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ success: false, message: 'Authentication token required' });
};

export { authorizeRoles } from './rbac';

