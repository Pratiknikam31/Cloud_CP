import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../models/User';

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
    const secret = process.env.JWT_SECRET || 'smarthospital_jwt_super_secret_key_2026_production_ready';

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
