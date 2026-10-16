import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types/entities';
import { env } from '../config/env';

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

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
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
      req.user = {
        ...decoded,
        id: userId,
        _id: userId
      };
      return next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ success: false, message: 'Authentication token required' });
};

export { authorizeRoles } from './rbac';
